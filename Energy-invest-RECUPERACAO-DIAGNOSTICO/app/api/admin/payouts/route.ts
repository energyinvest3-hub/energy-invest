import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/security";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("load") }),
  z.object({ action: z.literal("set_auto"), enabled: z.boolean() }),
  z.object({ action: z.literal("authorize_withdrawal"), withdrawalId: z.string().uuid() }),
  z.object({
    action: z.literal("create_manual_pix"),
    recipientName: z.string().min(1).max(120),
    amount: z.number().positive().max(1000000),
    pixKeyType: z.enum(["cpf", "email", "phone", "random", "other"]),
    pixKey: z.string().min(3).max(200),
    note: z.string().max(500).optional().default(""),
  }),
  z.object({ action: z.literal("update_manual_pix"), id: z.string().uuid(), status: z.enum(["sent", "cancelled"]) }),
]);

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Origem inválida." }, { status: 403 });

    const input = schema.parse(await request.json());
    const db = await supabaseServer();
    const { data: { user } } = await db.auth.getUser();

    if (!user || user.app_metadata.role !== "ADMIN") {
      return Response.json({ error: "Administrador necessário." }, { status: 403 });
    }

    await rateLimit(`admin-payouts:${user.id}`, { limit: 30, windowSeconds: 60 });

    if (input.action === "load") {
      const admin = supabaseAdmin();
      const [settings, manual] = await Promise.all([
        admin.from("withdrawal_control_settings").select("*").eq("id", true).maybeSingle(),
        admin.from("admin_manual_pix").select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      if (settings.error) throw settings.error;
      if (manual.error) throw manual.error;
      return Response.json({ settings: settings.data ?? { automatic_processing_enabled: false }, manualPix: manual.data ?? [] });
    }

    if (input.action === "set_auto") {
      const { data, error } = await db.rpc("admin_set_automatic_withdrawals", { p_enabled: input.enabled });
      if (error) throw error;
      return Response.json({ ok: true, data });
    }

    if (input.action === "authorize_withdrawal") {
      const { data, error } = await db.rpc("admin_authorize_automatic_withdrawal", { p_withdrawal_id: input.withdrawalId });
      if (error) throw error;
      return Response.json({ ok: true, data });
    }

    if (input.action === "create_manual_pix") {
      const { data, error } = await db.rpc("admin_create_manual_pix", {
        p_recipient_name: input.recipientName,
        p_amount: input.amount,
        p_pix_key_type: input.pixKeyType,
        p_pix_key: input.pixKey,
        p_note: input.note,
      });
      if (error) throw error;
      return Response.json({ ok: true, data });
    }

    const { data, error } = await db.rpc("admin_update_manual_pix", { p_id: input.id, p_status: input.status });
    if (error) throw error;
    return Response.json({ ok: true, data });
  } catch (error) {
    return Response.json({
      error: error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Dados inválidos."
        : error instanceof Error ? error.message : "Não foi possível concluir.",
    }, { status: 400 });
  }
}
