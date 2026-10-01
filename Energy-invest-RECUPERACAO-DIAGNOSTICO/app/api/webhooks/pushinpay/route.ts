import {
  pushinPayWebhookSchema,
  verifyPushinPayWebhook,
} from "@/lib/payments/pushinpay";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!verifyPushinPayWebhook(request)) {
      return Response.json(
        { error: "Webhook não autorizado." },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = pushinPayWebhookSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Webhook inválido." },
        { status: 400 },
      );
    }

    const event = parsed.data;
    const admin = supabaseAdmin();

    const {
      data: withdrawalData,
      error: withdrawalError,
    } = await admin.rpc(
      "settle_pushinpay_withdrawal",
      {
        p_cashout_id: event.id,
        p_value_cents: event.value,
        p_status: event.status,
        p_end_to_end_id: event.end_to_end_id ?? null,
      },
    );

    if (withdrawalError) {
      console.error(
        "PushinPay cashout webhook database error:",
        withdrawalError,
      );

      return Response.json(
        { error: "Falha temporária ao processar o saque." },
        {
          status: 503,
          headers: { "Retry-After": "15" },
        },
      );
    }

    if (
      withdrawalData &&
      typeof withdrawalData === "object" &&
      (withdrawalData as { processed?: boolean }).processed
    ) {
      return Response.json({
        received: true,
        kind: "cashout",
        result: withdrawalData,
      });
    }

    const { data, error } = await admin.rpc(
      "settle_pushinpay_deposit",
      {
        p_gateway_id: event.id,
        p_value_cents: event.value,
        p_status: event.status,
        p_end_to_end_id: event.end_to_end_id ?? null,
      },
    );

    if (error) {
      console.error(
        "PushinPay webhook database error:",
        error,
      );

      return Response.json(
        { error: "Falha temporária ao processar o pagamento." },
        {
          status: 503,
          headers: { "Retry-After": "15" },
        },
      );
    }

    if (
      data &&
      typeof data === "object" &&
      !(data as { processed?: boolean }).processed &&
      (data as { reason?: string }).reason === "deposit_not_found"
    ) {
      return Response.json(
        { error: "Transação ainda não vinculada. Tente novamente." },
        {
          status: 503,
          headers: { "Retry-After": "5" },
        },
      );
    }

    return Response.json({
      received: true,
      kind: "cashin",
      result: data,
    });
  } catch (error) {
    console.error("PushinPay webhook error:", error);

    return Response.json(
      { error: "Não foi possível processar o webhook." },
      { status: 400 },
    );
  }
}
