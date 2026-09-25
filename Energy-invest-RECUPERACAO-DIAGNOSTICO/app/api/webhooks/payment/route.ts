import {
  getPerfectPayExpectedCodes,
  PerfectPayWebhookError,
  readVerifiedPerfectPayWebhook,
} from "@/lib/payments/perfectpay";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { event, status, productCode, planCode } =
      await readVerifiedPerfectPayWebhook(request);

    if (event.currency_enum !== undefined && event.currency_enum !== 1) {
      return Response.json(
        { received: true, processed: false, reason: "unsupported_currency" },
        { status: 202 },
      );
    }

    const email = event.customer?.email?.trim().toLowerCase();
    if (!email) {
      return Response.json(
        { received: true, processed: false, reason: "missing_customer_email" },
        { status: 202 },
      );
    }

    const expected = getPerfectPayExpectedCodes();

    if (expected.productCode && productCode !== expected.productCode) {
      return Response.json(
        { received: true, processed: false, reason: "product_mismatch" },
        { status: 202 },
      );
    }

    if (expected.planCode && planCode !== expected.planCode) {
      return Response.json(
        { received: true, processed: false, reason: "plan_mismatch" },
        { status: 202 },
      );
    }

    const admin = supabaseAdmin();

    const { data, error } = await admin.rpc("process_perfectpay_webhook", {
      p_sale_code: event.code,
      p_amount: Math.round(event.sale_amount * 100) / 100,
      p_status: status,
      p_customer_email: email,
      p_product_code: productCode,
      p_plan_code: planCode,
    });

    if (error) {
      console.error("Perfect Pay webhook database error:", error);
      return Response.json(
        { error: "Falha temporária ao registrar o pagamento." },
        {
          status: 503,
          headers: { "Retry-After": "15" },
        },
      );
    }

    return Response.json(
      {
        received: true,
        saleCode: event.code,
        saleStatus: status,
        result: data,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof PerfectPayWebhookError) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Perfect Pay webhook error:", error);

    return Response.json(
      { error: "Não foi possível processar o webhook da Perfect Pay." },
      { status: 400 },
    );
  }
}
