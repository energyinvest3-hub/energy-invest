import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/security";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("load") }),
  z.object({
    action: z.literal("set_auto"),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("authorize_withdrawal"),
    withdrawalId: z.string().uuid(),
  }),
]);

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
      return Response.json(
        { error: "Origem inválida." },
        { status: 403 },
      );
    }

    const input = schema.parse(await request.json());
    const db = await supabaseServer();

    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user || user.app_metadata.role !== "ADMIN") {
      return Response.json(
        { error: "Administrador necessário." },
        { status: 403 },
      );
    }

    await rateLimit(`admin-payouts:${user.id}`, {
      limit: 30,
      windowSeconds: 60,
    });

    if (input.action === "load") {
      const admin = supabaseAdmin();

      const { data, error } = await admin
        .from("withdrawal_control_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();

      if (error) throw error;

      return Response.json({
        settings:
          data ?? {
            automatic_processing_enabled: false,
          },
      });
    }

    if (input.action === "set_auto") {
      const { data, error } = await db.rpc(
        "admin_set_automatic_withdrawals",
        { p_enabled: input.enabled },
      );

      if (error) throw error;

      return Response.json({ ok: true, data });
    }

    const { data, error } = await db.rpc(
      "admin_authorize_automatic_withdrawal",
      {
        p_withdrawal_id: input.withdrawalId,
      },
    );

    if (error) throw error;

    return Response.json({ ok: true, data });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message ?? "Dados inválidos."
            : error instanceof Error
              ? error.message
              : "Não foi possível concluir.",
      },
      { status: 400 },
    );
  }
}
