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

    if (input.action === "load") {
      const admin = supabaseAdmin();

      const { data, error } = await admin
        .from("withdrawal_control_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();

      if (error) throw error;

      return Response.json({
        settings:
          data ?? {
            automatic_processing_enabled: false,
          },
      });
    }

    if (input.action === "set_auto") {
      const { data, error } = await db.rpc(
        "admin_set_automatic_withdrawals",
        { p_enabled: input.enabled },
      );

      if (error) throw error;

      return Response.json({ ok: true, data });
    }

    const admin = supabaseAdmin();

    const { data: withdrawal, error: claimError } = await db.rpc(
      "admin_claim_withdrawal_cashout",
      {
        p_withdrawal_id: input.withdrawalId,
      },
    );

    if (claimError) throw claimError;
    if (!withdrawal) throw new Error("Saque não encontrado.");

    const row = withdrawal as Record<string, unknown>;
    const netAmount = Number(row.net_amount ?? row.amount ?? 0);

    if (!Number.isFinite(netAmount) || netAmount <= 0) {
      throw new Error("Valor líquido do saque inválido.");
    }

    const valueCents = Math.round(netAmount * 100);

    try {
      const cashout = await createPushinPayCashOut({
        valueCents,
        pixKeyType: String(row.pix_key_type) as
          | "cpf"
          | "email"
          | "phone"
          | "random",
        pixKey: String(row.pix_key),
        webhookUrl: pushinPayWebhookUrl(request),
      });

      const { data: attached, error: attachError } = await admin.rpc(
        "attach_pushinpay_cashout",
        {
          p_withdrawal_id: input.withdrawalId,
          p_cashout_id: cashout.id,
          p_value_cents: cashout.value,
          p_status: cashout.status,
          p_end_to_end_id: cashout.end_to_end_id ?? null,
        },
      );

      if (attachError) throw attachError;

      const normalized = cashout.status.toLowerCase();

      if (
        normalized === "paid" ||
        normalized === "canceled" ||
        normalized === "cancelled"
      ) {
        const { error: settleError } = await admin.rpc(
          "settle_pushinpay_withdrawal",
          {
            p_cashout_id: cashout.id,
            p_value_cents: cashout.value,
            p_status: cashout.status,
            p_end_to_end_id: cashout.end_to_end_id ?? null,
          },
        );

        if (settleError) throw settleError;
      }

      return Response.json({
        ok: true,
        withdrawal: attached,
        cashout: {
          id: cashout.id,
          status: cashout.status,
          value: cashout.value,
          receiverName: cashout.receiver_name ?? null,
        },
        message:
          normalized === "paid"
            ? "PIX enviado e confirmado pela PushinPay."
            : "PIX enviado para processamento na PushinPay.",
      });
    } catch (error) {
      const retrySafe =
        error instanceof PushinPayCashOutError
          ? error.retrySafe
          : false;

      await admin
        .from("withdrawals")
        .update({
          cashout_status: retrySafe ? "failed" : "review",
          cashout_error:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Falha desconhecida no envio.",
        })
        .eq("id", input.withdrawalId)
        .eq("status", "pending");

      throw error;
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message ?? "Dados inválidos."
            : error instanceof Error
              ? error.message
              : "Não foi possível concluir.",
      },
      { status: 400 },
    );
  }
}
