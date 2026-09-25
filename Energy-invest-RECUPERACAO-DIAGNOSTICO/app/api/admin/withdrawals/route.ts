import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security";

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(["complete", "cancel"]),
});

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host"))
      return Response.json({ error: "Origem inválida." }, { status: 403 });

    const input = schema.parse(await request.json());
    const db = await supabaseServer();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user || user.app_metadata.role !== "ADMIN")
      return Response.json({ error: "Acesso negado." }, { status: 403 });

    await rateLimit(`admin-withdrawal:${user.id}`);

    const rpc = input.action === "complete" ? "complete_withdrawal" : "cancel_withdrawal";
    const { data, error } = await db.rpc(rpc, { p_withdrawal_id: input.id });
    if (error) throw error;

    return Response.json({ withdrawal: data });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "Solicitação inválida."
            : error instanceof Error
              ? error.message
              : "Não foi possível atualizar o saque.",
      },
      { status: 400 },
    );
  }
}
