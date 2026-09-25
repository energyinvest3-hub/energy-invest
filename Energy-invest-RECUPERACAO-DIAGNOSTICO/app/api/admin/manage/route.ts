import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_profile"),
    userId: z.string().uuid(),
    name: z.string().min(1).max(120),
    phone: z.string().max(40),
  }),
  z.object({
    action: z.literal("adjust_wallet"),
    userId: z.string().uuid(),
    delta: z.number().min(-1000000).max(1000000).refine((v) => v !== 0),
    reason: z.string().min(3).max(300),
  }),
  z.object({
    action: z.literal("toggle_user"),
    userId: z.string().uuid(),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("delete_project"),
    projectId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("referral_settings"),
    active: z.boolean(),
    rewardAmount: z.number().min(0).max(100000),
    minPurchaseAmount: z.number().min(0).max(1000000),
  }),
  z.object({ action: z.literal("process_credits") }),
  z.object({ action: z.literal("reconcile_syncpay") }),
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
    if (!sameOrigin(request))
      return Response.json({ error: "Origem inválida." }, { status: 403 });

    const input = schema.parse(await request.json());
    const db = await supabaseServer();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return Response.json({ error: "Entre na sua conta." }, { status: 401 });

    await rateLimit(`admin-manage:${user.id}`);

    let data: unknown = null;
    let error: { message?: string } | null = null;

    if (input.action === "update_profile") {
      ({ data, error } = await db.rpc("admin_update_profile", {
        p_user_id: input.userId,
        p_name: input.name,
        p_phone: input.phone,
      }));
    } else if (input.action === "adjust_wallet") {
      ({ data, error } = await db.rpc("admin_adjust_wallet", {
        p_user_id: input.userId,
        p_delta: input.delta,
        p_reason: input.reason,
      }));
    } else if (input.action === "toggle_user") {
      ({ data, error } = await db.rpc("admin_set_user_enabled", {
        p_user_id: input.userId,
        p_enabled: input.enabled,
      }));
    } else if (input.action === "delete_project") {
      ({ data, error } = await db.rpc("admin_delete_project", {
        p_project_id: input.projectId,
      }));
    } else if (input.action === "referral_settings") {
      ({ data, error } = await db.rpc("admin_update_referral_settings", {
        p_active: input.active,
        p_reward_amount: input.rewardAmount,
        p_min_purchase_amount: input.minPurchaseAmount,
      }));
    } else if (input.action === "process_credits") {
      ({ data, error } = await db.rpc("admin_process_due_credits"));
    } else if (input.action === "reconcile_syncpay") {
      ({ data, error } = await db.rpc("admin_reconcile_syncpay"));
    }

    if (error) throw new Error(error.message || "Falha na operação administrativa.");
    return Response.json({ ok: true, data });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message || "Dados inválidos."
            : error instanceof Error
              ? error.message
              : "Não foi possível concluir a operação.",
      },
      { status: 400 },
    );
  }
}
