import {
  PerfectPayWebhookError,
  readVerifiedPerfectPayWebhook,
} from "@/lib/payments/perfectpay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { event, status } = await readVerifiedPerfectPayWebhook(request);

    // Intentionally no wallet mutation here. The Perfect Pay webhook is accepted
    // only as a verified sale event. Real wallet funding remains disabled.
    return Response.json(
      {
        received: true,
        processed: false,
        saleCode: event.code,
        saleStatus: status,
        message:
          "Evento Perfect Pay validado. Nenhum saldo financeiro foi alterado.",
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof PerfectPayWebhookError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: "Não foi possível validar o webhook da Perfect Pay." },
      { status: 400 },
    );
  }
}
