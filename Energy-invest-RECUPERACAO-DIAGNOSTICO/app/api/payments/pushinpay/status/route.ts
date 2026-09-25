import { z } from "zod";

import {
  clientIp,
  rateLimit,
  RateLimitError,
} from "@/lib/security";
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

    const { data: deposit, error } = await db
      .from("deposits")
      .select(
        "id,amount,status,gateway_id,provider_status,pix_code,qr_code_base64,paid_at,reversal_pending",
      )
      .eq("id", input.id)
      .eq("user_id", user.id)
      .eq("provider", "pushinpay")
      .single();

    if (error || !deposit) {
      return Response.json(
        { error: "Pagamento não encontrado." },
        { status: 404 },
      );
    }

    return Response.json({
      deposit: {
        id: String(deposit.id),
        identifier: String(deposit.gateway_id ?? deposit.id),
        amount: Number(deposit.amount),
        status: deposit.status,
        providerStatus: deposit.provider_status,
        pixCode: deposit.pix_code ?? "",
        qrCodeDataUrl: deposit.qr_code_base64 ?? "",
        reversalPending: Boolean(deposit.reversal_pending),
      },
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
