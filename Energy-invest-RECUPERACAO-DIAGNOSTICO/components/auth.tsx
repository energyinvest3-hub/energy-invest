"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowLeft,
  Sun,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { authSchema, type AuthInput } from "@/lib/validation";
import { Busy } from "./ui";
export function AuthPage({
  mode,
  demo,
}: {
  mode: "login" | "signup" | "recover" | "reset";
  demo: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AuthInput>({
    resolver: zodResolver(authSchema),
    defaultValues: { action: mode, terms: false },
  });
  const referralCode = searchParams.get("ref")?.trim().toUpperCase() ?? "";
  const recoveryError = searchParams.get("erro")?.trim() ?? "";

  useEffect(() => {
    if (recoveryError) setMessage(recoveryError);
  }, [recoveryError]);
  useEffect(() => {
    if (mode === "signup" && referralCode) {
      setValue("inviteCode", referralCode, { shouldValidate: true });
    }
  }, [mode, referralCode, setValue]);

  useEffect(() => {
    if (mode === "login" && searchParams.get("senha") === "alterada") {
      setSuccess(true);
      setMessage("Senha alterada com sucesso. Entre com sua nova senha.");
    }
  }, [mode, searchParams]);

  const titles = {
    login: "Bom ter você de volta.",
    signup: "Seu futuro começa aqui.",
    recover: "Vamos recuperar seu acesso.",
    reset: "Uma nova senha para sua conta.",
  };
  async function submit(values: AuthInput) {
    setMessage("");
    setSuccess(false);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (mode === "reset") {
        setSuccess(true);
        setMessage(d.message || "Senha alterada com sucesso. Entre novamente com sua nova senha.");
        window.setTimeout(() => {
          router.replace("/login?senha=alterada");
          router.refresh();
        }, 900);
      } else if (mode === "login" || d.authenticated) {
        router.push("/");
        router.refresh();
      } else {
        setSuccess(true);
        setMessage(d.message);
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      // Keep the form state predictable after every request.
    }
  }
  const field = (
    key: keyof AuthInput,
    label: string,
    type = "text",
    placeholder = "",
    autoComplete?: string,
  ) => (
    <label className="field" key={key}>
      {label}
      <div className={type === "password" ? "password-field" : ""}>
        <input
          {...register(key)}
          type={type === "password" ? (show ? "text" : "password") : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={!!errors[key]}
        />
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          >
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {errors[key] && (
        <span className="field-error">{errors[key]?.message}</span>
      )}
    </label>
  );
  return (
    <div className="auth-page">
      <aside className="auth-art">
        <Image
          src="/solar-1.jpg"
          alt="Geração de energia solar em meio à natureza"
          fill
          sizes="50vw"
          priority
        />
        <div>
          <span>
            <Sun size={21} /> UM FUTURO MAIS BRILHANTE
          </span>
          <h1>
            Boa energia.
            <br />
            Novas possibilidades.
          </h1>
          <p>
            Seus projetos solares e sua jornada,
            <br />
            conectados em um só lugar.
          </p>
        </div>
      </aside>
      <main className="auth-main">
        <Link href="/" className="auth-brand">
          <Image
            src="/logo.png"
            alt="EnergyInvest"
            width={186}
            height={134}
            priority
          />
        </Link>
        <div className="auth-form">
          <span className="eyebrow">
            {mode === "signup" ? "VAMOS COMEÇAR" : "SUA CONEXÃO COM A ENERGIA"}
          </span>
          <h1>{titles[mode]}</h1>
          <p>
            {mode === "login"
              ? "Entre para acompanhar seus projetos solares."
              : mode === "signup"
                ? "Crie sua conta e conheça novas possibilidades."
                : mode === "recover"
                  ? "Informe seu e-mail cadastrado. Enviaremos um link seguro para você criar uma nova senha."
                  : "Defina sua nova senha. Depois, entre novamente com ela."}
          </p>
          <form onSubmit={handleSubmit(submit)} noValidate>
            {mode === "signup" && (
              <>
                {field(
                  "name",
                  "Nome completo",
                  "text",
                  "Como podemos chamar você?",
                  "name",
                )}
                {field("phone", "Telefone", "tel", "(11) 99999-9999", "tel")}
              </>
            )}
            {mode === "login"
              ? field(
                  "identifier",
                  "Telefone ou e-mail",
                  "text",
                  "Seu telefone ou e-mail",
                  "username",
                )
              : mode === "signup" || mode === "recover"
                ? field("email", "E-mail", "email", "voce@exemplo.com", "email")
                : null}
            {mode !== "recover" &&
              field(
                "password",
                mode === "reset" ? "Nova senha" : "Senha",
                "password",
                "Pelo menos 8 caracteres",
                mode === "login" ? "current-password" : "new-password",
              )}
            {(mode === "signup" || mode === "reset") &&
              field(
                "confirm",
                "Confirmar senha",
                "password",
                "Repita sua senha",
                "new-password",
              )}
            {mode === "signup" && (
              <>
                {field(
                  "inviteCode",
                  "Código de convite (opcional)",
                  "text",
                  "Você recebeu um convite?",
                )}
                <label className="checkbox">
                  <input type="checkbox" {...register("terms")} />
                  <span>
                    Li e concordo com os{" "}
                    <Link href="/termos">Termos de Uso</Link> e a{" "}
                    <Link href="/privacidade">Política de Privacidade</Link>.
                  </span>
                </label>
                {errors.terms && (
                  <p className="field-error">{errors.terms.message}</p>
                )}
              </>
            )}
            {mode === "login" && (
              <Link className="forgot-link" href="/recuperar-senha">
                Esqueci minha senha
              </Link>
            )}
            {message && (
              <div
                role="status"
                className={success ? "form-success" : "form-error"}
              >
                {success && <CheckCircle2 size={19} />} {message}
              </div>
            )}
            <button
              className="button primary full"
              disabled={isSubmitting}
            >
              <Busy loading={isSubmitting}>
                {mode === "login"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Criar conta"
                    : mode === "recover"
                      ? "Enviar e-mail de recuperação"
                      : "Alterar minha senha"}
                <ArrowUpRight size={18} />
              </Busy>
            </button>
          </form>
          <p className="auth-switch">
            {mode === "login" ? (
              <>
                Ainda não tem conta? <Link href="/cadastro">Criar conta</Link>
              </>
            ) : mode === "signup" ? (
              <>
                Já tem uma conta? <Link href="/login">Entrar</Link>
              </>
            ) : (
              <Link href="/login">
                <ArrowLeft size={15} /> Voltar ao login
              </Link>
            )}
          </p>
          {demo && (
            <button
              className="button outline full"
              onClick={async () => {
                const r = await fetch("/api/demo", { method: "POST" });
                if (r.ok) {
                  router.push("/");
                  router.refresh();
                } else setMessage("Não foi possível iniciar a demonstração.");
              }}
            >
              Explorar demonstração <ArrowUpRight size={17} />
            </button>
          )}
          <div className="auth-security">
            <ShieldCheck size={15} /> Seus dados, tratados com cuidado.
          </div>
        </div>
      </main>
    </div>
  );
}
