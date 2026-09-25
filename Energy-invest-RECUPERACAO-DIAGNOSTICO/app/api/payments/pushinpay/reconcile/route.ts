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
    await rateLimit(`pushinpay-reconcile-user:${user.id}`, {
      limit: 3,
      windowSeconds: 60,
    });
    await rateLimit(`pushinpay-reconcile-ip:${ip}`, {
      limit: 12,
      windowSeconds: 60,
    });

    const { data: rows, error } = await db
      .from("deposits")
      .select("id,status,provider_status,gateway_id,created_at")
      .eq("user_id", user.id)
      .eq("provider", "pushinpay")
      .in("status", ["pending", "cancelled"])
      .not("gateway_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const candidates = (rows ?? []).filter((row) => {
      if (row.status === "pending") return true;
      const providerStatus = String(row.provider_status ?? "").toLowerCase();
      return !["canceled", "cancelled", "expired"].includes(providerStatus);
    });

    const admin = supabaseAdmin();
    let checked = 0;
    let credited = 0;
    let cancelled = 0;

    for (const row of candidates) {
      const { data: claim, error: claimError } = await admin.rpc(
        "claim_pushinpay_reconciliation",
        {
          p_deposit_id: row.id,
          p_user_id: user.id,
        },
      );

      if (claimError) {
        console.error("PushinPay reconciliation claim error:", claimError);
        continue;
      }

      if (
        !claim ||
        typeof claim !== "object" ||
        !(claim as { claimed?: boolean }).claimed
      ) {
        continue;
      }

      checked += 1;

      try {
        const transaction = await getPushinPayTransaction(
          String((claim as { gatewayId: string }).gatewayId),
        );

        if (!transaction) continue;

        const { data: settled, error: settleError } = await admin.rpc(
          "settle_pushinpay_deposit",
          {
            p_gateway_id: transaction.id,
            p_value_cents: transaction.value,
            p_status: transaction.status,
            p_end_to_end_id: transaction.end_to_end_id ?? null,
          },
        );

        if (settleError) {
          console.error("PushinPay reconciliation settle error:", settleError);
          continue;
        }

        if (
          settled &&
          typeof settled === "object" &&
          (settled as { credited?: boolean }).credited
        ) {
          credited += 1;
        }

        if (
          settled &&
          typeof settled === "object" &&
          (settled as { cancelled?: boolean }).cancelled
        ) {
          cancelled += 1;
        }
      } catch (providerError) {
        console.error("PushinPay reconciliation provider error:", providerError);
      }
    }

    return Response.json({ ok: true, checked, credited, cancelled });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: error.message }, { status: 429 });
    }

    console.error("PushinPay reconciliation error:", error);
    return Response.json(
      { error: "Não foi possível reconciliar os pagamentos agora." },
      { status: 400 },
    );
  }
}
