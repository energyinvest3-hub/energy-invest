import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value === "/redefinir-senha" ? value : "/";
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    const target = new URL("/recuperar-senha", url.origin);
    target.searchParams.set(
      "erro",
      errorDescription || "O link de recuperação expirou ou já foi utilizado.",
    );
    return NextResponse.redirect(target);
  }

  const db = await supabaseServer();

  // NOVO FLUXO: recuperação por TokenHash
  if (tokenHash && type) {
    const { error: verifyError } = await db.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!verifyError) {
      return NextResponse.redirect(
        new URL(safeNext(url.searchParams.get("next")), url.origin),
      );
    }
  }

  // Mantém compatibilidade com o fluxo antigo PKCE
  if (code) {
    const { error: exchangeError } =
      await db.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      return NextResponse.redirect(
        new URL(safeNext(url.searchParams.get("next")), url.origin),
      );
    }
  }

  const target = new URL("/recuperar-senha", url.origin);
  target.searchParams.set(
    "erro",
    "Não foi possível validar este link. Solicite um novo e-mail de recuperação.",
  );

  return NextResponse.redirect(target);
}
