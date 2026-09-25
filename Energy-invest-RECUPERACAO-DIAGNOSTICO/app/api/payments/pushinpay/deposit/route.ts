import { z } from "zod";

import {
  createPushinPayCharge,
  normalizePushinPayQr,
  pushinPayWebhookUrl,
} from "@/lib/payments/pushinpay";
import {
  clientIp,
  rateLimit,
  RateLimitError,
} from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.number().min(1).max(100000),
});

function firstRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

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

export async function POST(request: Request) {
  let localDepositId: string | null = null;

  try {
    if (!sameOrigin(request)) {
      return Response.json({ error: "Origem inválida." }, { status: 403 });
    }

    if (process.env.DEPOSITS_DISABLED === "true") {
      return Response.json(
        { error: "Novos pagamentos estão temporariamente indisponíveis." },
        { status: 503 },
      );
    }

    const db = await supabaseServer();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return Response.json({ error: "Entre na sua conta." }, { status: 401 });
    }

    const ip = clientIp(request);

    await rateLimit(`pushinpay-create-user:${user.id}`, {
      limit: 2,
      windowSeconds: 60,
    });

    await rateLimit(`pushinpay-create-ip:${ip}`, {
      limit: 5,
      windowSeconds: 60,
    });

    const input = schema.parse(await request.json());
    const amount = Math.round(input.amount * 100) / 100;
    const valueCents = Math.round(amount * 100);

    const { data: createdRaw, error: createError } = await db.rpc(
      "create_pushinpay_deposit",
      { p_amount: amount },
    );
    const created = firstRow(createdRaw);

    if (createError || !created || !(created as { id?: string }).id) {
      throw new Error(
        createError?.message || "Não foi possível iniciar o pagamento.",
      );
    }

    localDepositId = String((created as { id: string }).id);

    const charge = await createPushinPayCharge(
      valueCents,
      pushinPayWebhookUrl(request),
    );

    if (charge.value !== valueCents) {
      throw new Error("A PushinPay retornou um valor diferente da cobrança.");
    }

    const admin = supabaseAdmin();
    const { data: attachedRaw, error: attachError } = await admin.rpc(
      "attach_pushinpay_charge",
      {
        p_deposit_id: localDepositId,
        p_gateway_id: charge.id,
        p_qr_code: charge.qr_code,
        p_qr_code_base64: normalizePushinPayQr(charge.qr_code_base64),
        p_provider_status: charge.status,
        p_value_cents: charge.value,
      },
    );
    const attached = firstRow(attachedRaw) as Record<string, unknown> | null;

    if (attachError || !attached?.id) {
      throw new Error(
        attachError?.message || "Não foi possível registrar o PIX criado.",
      );
    }

    return Response.json({
      deposit: {
        id: String(attached.id),
        identifier: String(attached.gateway_id),
        amount: Number(attached.amount),
        status: attached.status,
        providerStatus: attached.provider_status,
        pixCode: String(attached.pix_code ?? ""),
        qrCodeDataUrl: String(attached.qr_code_base64 ?? ""),
      },
    });
  } catch (error) {
    if (localDepositId) {
      try {
        const admin = supabaseAdmin();
        await admin.rpc("cancel_pushinpay_deposit", {
          p_deposit_id: localDepositId,
          p_reason: "creation_failed",
        });
      } catch {
        // Não mascara o erro original.
      }
    }

    if (error instanceof RateLimitError) {
      return Response.json({ error: error.message }, { status: 429 });
    }

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Informe um valor válido para o PIX." },
        { status: 400 },
      );
    }

    console.error("PushinPay create PIX error:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar o PIX.",
      },
      { status: 400 },
    );
  }
}
