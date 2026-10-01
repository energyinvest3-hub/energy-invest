import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/security";
import {
  createPushinPayCashOut,
  PushinPayCashOutError,
  pushinPayWebhookUrl,
} from "@/lib/payments/pushinpay";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("load") }),
  z.object({
    action: z.literal("set_auto"),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("authorize_withdrawal"),
    withdrawalId: z.string().uuid(),
  }),
]);

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;

    for (const key of ["message", "error", "details", "hint"]) {
      if (
        typeof value[key] === "string" &&
        String(value[key]).trim()
      ) {
        return String(value[key]).trim();
      }
    }
  }

  return "Não foi possível concluir.";
}

async function loadSettings() {
  const admin = supabaseAdmin();

  let { data, error } = await admin
    .from("withdrawal_control_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    const created = await admin
      .from("withdrawal_control_settings")
      .upsert(
        {
          id: true,
          automatic_processing_enabled: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (created.error) {
      throw new Error(created.error.message);
    }

    data = created.data;
  }

  return data;
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) {
      return Response.json(
        { error: "Origem inválida." },
        { status: 403 },
      );
    }

    const input = schema.parse(await request.json());
    const db = await supabaseServer();

    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user || user.app_metadata.role !== "ADMIN") {
      return Response.json(
        { error: "Administrador necessário." },
        { status: 403 },
      );
    }

    await rateLimit(`admin-payouts:${user.id}`, {
      limit: 20,
      windowSeconds: 60,
    });

    const admin = supabaseAdmin();

    if (input.action === "load") {
      const settings = await loadSettings();
      return Response.json({ settings });
    }

    if (input.action === "set_auto") {
      const { data, error } = await admin
        .from("withdrawal_control_settings")
        .upsert(
          {
            id: true,
            automatic_processing_enabled: input.enabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        )
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      await admin.from("admin_audit_logs").insert({
        admin_user_id: user.id,
        action: "set_automatic_withdrawals",
        target_type: "withdrawal_settings",
        metadata: {
          enabled: input.enabled,
          source: "admin_payouts_api",
        },
      });

      return Response.json({
        ok: true,
        settings: data,
      });
    }

    const settings = await loadSettings();

    if (!settings.automatic_processing_enabled) {
      throw new Error(
        "O PIX CashOut está desativado. Ative e salve em Configurações antes de enviar.",
      );
    }

    const { data: withdrawal, error: claimError } =
      await admin.rpc(
        "service_claim_pushinpay_cashout",
        {
          p_withdrawal_id: input.withdrawalId,
          p_admin_user_id: user.id,
        },
      );

    if (claimError) {
      throw new Error(claimError.message);
    }

    if (!withdrawal) {
      throw new Error("Saque não encontrado.");
    }

    const row = withdrawal as Record<string, unknown>;
    const netAmount = Number(
      row.net_amount ?? row.amount ?? 0,
    );

    if (
      !Number.isFinite(netAmount) ||
      netAmount <= 0
    ) {
      throw new Error(
        "Valor líquido do saque inválido.",
      );
    }

    const valueCents = Math.round(
      netAmount * 100,
    );

    try {
      const cashout =
        await createPushinPayCashOut({
          valueCents,
          pixKeyType: String(
            row.pix_key_type,
          ) as
            | "cpf"
            | "email"
            | "phone"
            | "random",
          pixKey: String(row.pix_key),
          webhookUrl:
            pushinPayWebhookUrl(request),
        });

      const {
        data: attached,
        error: attachError,
      } = await admin.rpc(
        "attach_pushinpay_cashout",
        {
          p_withdrawal_id:
            input.withdrawalId,
          p_cashout_id: cashout.id,
          p_value_cents: cashout.value,
          p_status: cashout.status,
          p_end_to_end_id:
            cashout.end_to_end_id ??
            null,
        },
      );

      if (attachError) {
        throw new Error(
          attachError.message,
        );
      }

      const normalized =
        cashout.status.toLowerCase();

      if (
        normalized === "paid" ||
        normalized === "canceled" ||
        normalized === "cancelled"
      ) {
        const { error: settleError } =
          await admin.rpc(
            "settle_pushinpay_withdrawal",
            {
              p_cashout_id: cashout.id,
              p_value_cents:
                cashout.value,
              p_status: cashout.status,
              p_end_to_end_id:
                cashout.end_to_end_id ??
                null,
            },
          );

        if (settleError) {
          throw new Error(
            settleError.message,
          );
        }
      }

      return Response.json({
        ok: true,
        withdrawal: attached,
        cashout: {
          id: cashout.id,
          status: cashout.status,
          value: cashout.value,
          receiverName:
            cashout.receiver_name ??
            null,
        },
        message:
          normalized === "paid"
            ? "PIX enviado e confirmado pela PushinPay."
            : "PIX enviado para processamento na PushinPay.",
      });
    } catch (error) {
      const retrySafe =
        error instanceof
        PushinPayCashOutError
          ? error.retrySafe
          : false;

      await admin
        .from("withdrawals")
        .update({
          cashout_status:
            retrySafe
              ? "failed"
              : "review",
          cashout_error:
            errorMessage(error).slice(
              0,
              500,
            ),
        })
        .eq("id", input.withdrawalId)
        .eq("status", "pending");

      throw error;
    }
  } catch (error) {
    return Response.json(
      {
        error: errorMessage(error),
      },
      { status: 400 },
    );
  }
}
