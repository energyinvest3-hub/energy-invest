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
      return Response.json({ error: "Webhook não autorizado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = pushinPayWebhookSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "Webhook inválido." }, { status: 400 });
    }

    const event = parsed.data;
    const admin = supabaseAdmin();
    const { data, error } = await admin.rpc("settle_pushinpay_deposit", {
      p_gateway_id: event.id,
      p_value_cents: event.value,
      p_status: event.status,
      p_end_to_end_id: event.end_to_end_id ?? null,
    });

    if (error) {
      console.error("PushinPay webhook database error:", error);
      return Response.json(
        { error: "Falha temporária ao processar o pagamento." },
        { status: 503, headers: { "Retry-After": "15" } },
      );
    }

    return Response.json({ received: true, result: data });
  } catch (error) {
    console.error("PushinPay webhook error:", error);
    return Response.json(
      { error: "Não foi possível processar o webhook." },
      { status: 400 },
    );
  }
}
