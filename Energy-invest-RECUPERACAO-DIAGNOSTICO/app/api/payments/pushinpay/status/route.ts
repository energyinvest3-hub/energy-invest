import { z } from "zod";

import { getPushinPayTransaction } from "@/lib/payments/pushinpay";
import {
  clientIp,
  rateLimit,
  RateLimitError,
} from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ id: z.string().uuid() });

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function readDeposit(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
  id: string,
) {
  const { data, error } = await db
    .from("deposits")
    .select(
      "id,amount,status,gateway_id,provider_status,pix_code,qr_code_base64,paid_at,reversal_pending,provider_checked_at",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .eq("provider", "pushinpay")
    .single();

  if (error || !data) return null;
  return data;
}

function responseDeposit(deposit: Record<string, unknown>) {
  return {
    id: String(deposit.id),
    identifier: String(deposit.gateway_id ?? deposit.id),
    amount: Number(deposit.amount),
    status: deposit.status,
    providerStatus: deposit.provider_status,
    pixCode: deposit.pix_code ?? "",
    qrCodeDataUrl: deposit.qr_code_base64 ?? "",
    reversalPending: Boolean(deposit.reversal_pending),
  };
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) {
      return Response.json({ error: "Origem inválida." }, { status: 403 });
    }

    const db = await supabaseServer();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return Response.json({ error: "Entre na sua conta." }, { status: 401 });
    }

    const ip = clientIp(request);
    await rateLimit(`pushinpay-status-user:${user.id}`, {
      limit: 30,
      windowSeconds: 60,
    });
    await rateLimit(`pushinpay-status-ip:${ip}`, {
      limit: 80,
      windowSeconds: 60,
    });

    const input = schema.parse(await request.json());
    let deposit = await readDeposit(db, user.id, input.id);

    if (!deposit) {
      return Response.json(
        { error: "Pagamento não encontrado." },
        { status: 404 },
      );
    }

    if (
      deposit.status !== "completed" &&
      typeof deposit.gateway_id === "string" &&
      deposit.gateway_id
    ) {
      const admin = supabaseAdmin();
      const { data: claim, error: claimError } = await admin.rpc(
        "claim_pushinpay_reconciliation",
        {
          p_deposit_id: input.id,
          p_user_id: user.id,
        },
      );

      if (claimError) {
        console.error("PushinPay reconciliation claim error:", claimError);
      } else if (
        claim &&
        typeof claim === "object" &&
        (claim as { claimed?: boolean }).claimed
      ) {
        try {
          const transaction = await getPushinPayTransaction(
            String((claim as { gatewayId: string }).gatewayId),
          );

          if (transaction) {
            await admin.rpc("settle_pushinpay_deposit", {
              p_gateway_id: transaction.id,
              p_value_cents: transaction.value,
              p_status: transaction.status,
              p_end_to_end_id: transaction.end_to_end_id ?? null,
            });
          }
        } catch (error) {
          console.error("PushinPay direct status fallback error:", error);
        }

        deposit = (await readDeposit(db, user.id, input.id)) ?? deposit;
      }
    }

    return Response.json({
      deposit: responseDeposit(deposit as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: error.message }, { status: 429 });
    }

    if (error instanceof z.ZodError) {
      return Response.json({ error: "Pagamento inválido." }, { status: 400 });
    }

    console.error("PushinPay status error:", error);
    return Response.json(
      { error: "Não foi possível consultar o pagamento." },
      { status: 400 },
    );
  }
}
