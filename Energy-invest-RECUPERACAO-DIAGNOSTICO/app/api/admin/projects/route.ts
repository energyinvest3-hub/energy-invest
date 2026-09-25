import { supabaseServer } from "@/lib/supabase/server";
import { projectSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/security";
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host"))
      return Response.json({ error: "Origem inválida." }, { status: 403 });
    const db = await supabaseServer();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user || user.app_metadata.role !== "ADMIN")
      return Response.json({ error: "Acesso restrito." }, { status: 403 });
    await rateLimit(`admin:${user.id}`);
    const p = projectSchema.safeParse(await request.json());
    if (!p.success)
      return Response.json(
        { error: p.error.issues[0].message },
        { status: 400 },
      );
    const { id, ...rawValues } = p.data;
    const values = {
      ...rawValues,
      daily_projected_return:
        Math.round(
          ((rawValues.investment_amount * rawValues.return_multiplier) /
            rawValues.duration_days) *
            100,
        ) / 100,
    };
    const query = id
      ? db.from("solar_projects").update(values).eq("id", id)
      : db.from("solar_projects").insert(values);
    const { error } = await query;
    if (error) throw new Error("Não foi possível salvar o projeto.");
    const { error: auditError } = await db.from("admin_audit_logs").insert({
      admin_user_id: user.id,
      action: id ? `project_${values.status}` : "project_created",
      target_type: "solar_project",
      target_id: id ?? null,
      metadata: { name: values.name, status: values.status },
    });
    if (auditError)
      throw new Error(
        "O projeto foi salvo, mas o registro de auditoria falhou. Revise a configuração do banco.",
      );
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erro ao salvar." },
      { status: 400 },
    );
  }
}
