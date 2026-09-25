import { z } from "zod";

import { createPerfectPayDeposit } from "@/lib/payments/perfectpay-deposits";
import {
  clientIp,
  rateLimit,
  RateLimitError,
} from "@/lib/security";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.number().min(1).max(100000),
  cpf: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 11, "Informe um CPF válido."),
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

    if (process.env.DEPOSITS_DISABLED === "true") {
      return Response.json(
        { error: "Pagamentos temporariamente indisponíveis." },
        { status: 503 },
      );
    }

    const input = schema.parse(await request.json());
    const ip = clientIp(request);

    await rateLimit(`perfectpay-create-ip:${ip}`, {
      limit: 5,
      windowSeconds: 60,
    });

    const db = await supabaseServer();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return Response.json({ error: "Entre na sua conta." }, { status: 401 });
    }

    await rateLimit(`perfectpay-create-user:${user.id}`, {
      limit: 2,
      windowSeconds: 60,
    });

    const result = await createPerfectPayDeposit(db, user, input);

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
            : "Não foi possível iniciar o pagamento.",
      },
      { status: 400 },
    );
  }
}
