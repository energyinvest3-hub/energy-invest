import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security";

const schema = z.object({ id: z.string().uuid() });

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
    await rateLimit(user.id);
    const { data, error } = await db.rpc("credit_goal_reward", {
      p_reward_id: input.id,
    });
    if (error) throw error;
    return Response.json({ reward: data });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "Recompensa inválida."
            : error instanceof Error
              ? error.message
              : "Não foi possível creditar o bônus.",
      },
      { status: 400 },
    );
  }
}
