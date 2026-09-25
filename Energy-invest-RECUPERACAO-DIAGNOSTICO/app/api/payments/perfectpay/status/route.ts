import { z } from "zod";

import { getPerfectPayDepositStatus } from "@/lib/payments/perfectpay-deposits";
import {
  clientIp,
  rateLimit,
  RateLimitError,
} from "@/lib/security";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().uuid(),
});

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
      return Response.json({ error: "Origem inválida." }, { status: 403 });
    }

    const input = schema.parse(await request.json());
    const db = await supabaseServer();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return Response.json({ error: "Entre na sua conta." }, { status: 401 });
    }

    const ip = clientIp(request);

    await rateLimit(`perfectpay-status-user:${user.id}`, {
      limit: 30,
      windowSeconds: 60,
    });

    await rateLimit(`perfectpay-status-ip:${ip}`, {
      limit: 80,
      windowSeconds: 60,
    });

    const result = await getPerfectPayDepositStatus(db, user.id, input.id);

    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar o pagamento.",
      },
      { status: 400 },
    );
  }
}
