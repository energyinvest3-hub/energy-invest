import { authSchema } from "@/lib/validation";
import { supabaseServer } from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { rateLimit } from "@/lib/security";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  if (!host) return true;
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

    const parsed = authSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );

    const d = parsed.data;
    await rateLimit(
      `auth:${request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown"}`,
    );
    const db = await supabaseServer();

    if (d.action === "login") {
      const identifier = d.identifier!.trim();
      const login = identifier.includes("@")
        ? { email: identifier.toLowerCase(), password: d.password! }
        : {
            phone: identifier.startsWith("+")
              ? identifier.replace(/[^+\d]/g, "")
              : `+55${identifier.replace(/\D/g, "")}`,
            password: d.password!,
          };
      const { error } = await db.auth.signInWithPassword(login);
      if (error)
        return Response.json(
          { error: "E-mail/telefone ou senha incorretos." },
          { status: 401 },
        );
      return Response.json({ ok: true, authenticated: true });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://energy-invest-git-main-energy-invest.vercel.app";

    if (d.action === "signup") {
      // Use the server-side registration function. It creates an already-confirmed
      // Supabase Auth user and triggers profile + wallet creation atomically.
      const register = await fetch(`${SUPABASE_URL}/functions/v1/register-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: d.name,
          email: d.email,
          phone: d.phone,
          password: d.password,
          inviteCode: d.inviteCode?.trim() || "",
        }),
        cache: "no-store",
      });
      const result = await register.json().catch(() => ({}));
      if (!register.ok) {
        const error =
          typeof result.error === "string"
            ? result.error
            : "Não foi possível criar a conta agora.";
        return Response.json({ error }, { status: register.status || 400 });
      }

      const { error: loginError } = await db.auth.signInWithPassword({
        email: d.email!.trim().toLowerCase(),
        password: d.password!,
      });
      if (loginError)
        return Response.json(
          {
            error:
              "A conta foi criada, mas não foi possível iniciar a sessão. Entre pela tela de login.",
            accountCreated: true,
          },
          { status: 409 },
        );

      return Response.json({ ok: true, authenticated: true });
    }

    if (d.action === "recover") {
      const email = d.email!.trim().toLowerCase();
      const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/auth/callback?next=/redefinir-senha`,
      });
      if (error) {
        const raw = [error.message, error.code, error.status].filter(Boolean).join(" | ");
        console.error("Password recovery failed:", raw);

        const message = error.message?.toLowerCase() ?? "";
        let friendly = "Não foi possível enviar o e-mail de recuperação.";

        if (message.includes("smtp") || message.includes("email address not authorized") || message.includes("sending")) {
          friendly = "O servidor de e-mail (SMTP) recusou o envio. Verifique o Gmail, a senha de app e as configurações SMTP da Supabase.";
        } else if (message.includes("redirect") || message.includes("url")) {
          friendly = "A URL de recuperação não está autorizada na Supabase. Verifique Auth → URL Configuration → Redirect URLs.";
        } else if (message.includes("rate") || message.includes("too many")) {
          friendly = "Muitas tentativas de recuperação. Aguarde alguns minutos e tente novamente.";
        }

        return Response.json(
          { error: friendly, detail: raw || "Erro de envio não identificado." },
          { status: Number(error.status) || 400 },
        );
      }
      return Response.json({
        message:
          "Se este e-mail estiver cadastrado, enviamos um link para você criar uma nova senha. Confira também a caixa de spam.",
      });
    }

    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return Response.json(
        { error: "Abra o link de recuperação enviado ao seu e-mail." },
        { status: 401 },
      );

    const { error } = await db.auth.updateUser({ password: d.password! });
    if (error)
      throw new Error(
        "Não foi possível alterar a senha. Solicite um novo link de recuperação.",
      );

    // Encerra a sessão de recuperação após a troca para que a nova senha
    // seja testada em um novo login e o link não permaneça como sessão ativa.
    await db.auth.signOut();
    return Response.json({
      ok: true,
      authenticated: false,
      message: "Senha alterada com sucesso. Entre novamente com sua nova senha.",
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Não foi possível concluir." },
      { status: 400 },
    );
  }
}
