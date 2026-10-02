"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  House,
  Sun,
  PanelsTopLeft,
  Wallet,
  UserRound,
  Bell,
  ArrowUpRight,
  ShieldCheck,
  X,
  CheckCircle2,
  Info,
  LogOut,
  Sparkles,
} from "lucide-react";
import type { AppData } from "@/lib/types";
import { money } from "@/lib/format";
import { performAction } from "@/services/projects";
import {
  premiumPlanDepositTotal,
  premiumPlanMinDeposit,
} from "@/lib/premium-plan";
const Context = createContext<{
  data: AppData;
  toast: (message: string, error?: boolean) => void;
  refresh: () => void;
} | null>(null);
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider required");
  return value;
}
export function AppProvider({
  initial,
  children,
}: {
  initial: AppData;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const toast = useCallback(
    (text: string, error = false) => setNotice({ text, error }),
    [],
  );
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  return (
    <Context.Provider
      value={{ data: initial, toast, refresh }}
    >
      {children}
      {notice && (
        <div className={`toast ${notice.error ? "error" : ""}`} role="status">
          {notice.error ? <Info size={20} /> : <CheckCircle2 size={20} />}
          <span>{notice.text}</span>
          <button aria-label="Fechar aviso" onClick={() => setNotice(null)}>
            <X size={18} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
const navigation = [
  { href: "/", label: "Início", icon: House },
  { href: "/projetos", label: "Projetos", icon: Sun },
  { href: "/meus-paineis", label: "Meus painéis", icon: PanelsTopLeft },
  { href: "/carteira", label: "Carteira", icon: Wallet },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="EnergyInvest início">
      <Image
        src="/logo.png"
        width={150}
        height={108}
        alt="EnergyInvest"
        priority
      />
      <span className="brand-word">
        Energy<span>Invest</span>
      </span>
    </Link>
  );
}
export function BottomNavigation() {
  const path = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {navigation.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={
            (href === "/" ? path === href : path.startsWith(href))
              ? "page"
              : undefined
          }
          className={
            (href === "/" ? path === href : path.startsWith(href))
              ? "selected"
              : ""
          }
        >
          <Icon size={22} strokeWidth={1.8} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
export function AppHeader() {
  const { data } = useApp();
  return (
    <header className="app-header">
      <Brand />
      <div className="header-actions">
        <span className="header-date">Energia para o seu futuro</span>
        <Link
          className="icon-button notification-button"
          href="/notificacoes"
          aria-label="Notificações"
        >
          <Bell size={21} />
          {data.notifications.some((n) => !n.read) && <i />}
        </Link>
        <Link className="avatar small" href="/perfil" aria-label="Meu perfil">
          {data.profile.name.slice(0, 1).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
export function WhatsAppFloatingButton() {
  const { toast } = useApp();
  const url = process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL || "https://wa.me/5511977692699";
  const valid =
    url &&
    /^https:\/\/(chat\.whatsapp\.com|wa\.me|www\.whatsapp\.com)\//.test(url);
  return valid ? (
    <a
      className="whatsapp"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir comunidade no WhatsApp"
    >
      <WhatsAppIcon />
    </a>
  ) : (
    <button
      className="whatsapp"
      onClick={() =>
        toast("O link da comunidade será disponibilizado em breve.")
      }
      aria-label="Comunidade no WhatsApp"
    >
      <WhatsAppIcon />
    </button>
  );
}
function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="27"
      height="27"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M25.4 6.7A13 13 0 0 0 5 22.3L3.3 28.7l6.5-1.7A13 13 0 0 0 25.4 6.7Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M11.2 9.9c.3-.6.6-.6 1-.6h.7c.2 0 .5.1.6.5l1.2 2.9c.1.3.1.6-.1.8l-.9 1.1c-.2.2-.2.5 0 .8 1 1.8 2.5 3.2 4.4 4.1.3.2.6.1.8-.1l1.2-1.4c.2-.3.5-.3.8-.2l2.8 1.3c.3.2.5.4.5.7 0 .7-.3 2.2-1.5 3-1 .7-2.4 1-4.2.4-2.4-.8-4.9-2.3-6.8-4.2-1.6-1.6-3.1-3.8-3.5-5.7-.4-1.7.2-2.8 1-3.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LaunchTicker() {
  const items = [
    "PROMOÇÃO ESPECIAL",
    "SOLAR RIO RESIDENCIAL · R$ 100",
    "SOLAR PARANÁ PRO · R$ 150",
    "15 DIAS · 2,5X",
    "CONDIÇÃO PROMOCIONAL POR TEMPO LIMITADO",
    "PLANO PRÊMIO · R$ 50 EM DEPÓSITOS CONFIRMADOS",
  ];
  const repeated = [...items, ...items];
  return (
    <div className="launch-ticker" aria-label="Novidades da plataforma">
      <div className="launch-ticker-track">
        {repeated.map((item, index) => (
          <span key={`${item}-${index}`}>
            <Sparkles size={13} /> {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function LaunchWelcomeModal() {
  const { data } = useApp();
  const [open, setOpen] = useState(false);

  const premiumDeposited = premiumPlanDepositTotal(
    data.transactions,
  );
  const premiumRemaining = Math.max(
    0,
    premiumPlanMinDeposit - premiumDeposited,
  );
  const premiumEligible =
    premiumDeposited >= premiumPlanMinDeposit;

  // Mostra uma vez enquanto bloqueado e novamente quando o benefício for liberado.
  const storageKey =
    `energyinvest-premium-withdrawal-2026-10-v4:${data.profile.id}:${
      premiumEligible ? "active" : "locked"
    }`;

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) !== "1") {
        const timer = window.setTimeout(
          () => setOpen(true),
          500,
        );

        return () =>
          window.clearTimeout(timer);
      }
    } catch {
      // LocalStorage pode estar indisponível em contextos restritos.
    }
  }, [storageKey]);

  const close = () => {
    try {
      window.localStorage.setItem(
        storageKey,
        "1",
      );
    } catch {}

    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="launch-modal-backdrop promo-v2-backdrop"
      role="presentation"
      onMouseDown={close}
    >
      <section
        className="promo-v2 premium-withdrawal-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="premium-withdrawal-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <button
          className="promo-v2-close"
          aria-label="Fechar promoção"
          onClick={close}
        >
          <X size={20} />
        </button>

        <div className="promo-v2-content">
          <div className="promo-v2-badge">
            <Sparkles size={15} />
            PROMOÇÃO ESPECIAL
          </div>

          <p className="promo-v2-kicker">
            {premiumEligible
              ? "PLANO PRÊMIO ATIVO"
              : "SAQUE PREMIUM"}
          </p>

          <h2 id="premium-withdrawal-title">
            {premiumEligible ? (
              <>
                Seu <span>saque premium</span> está
                liberado.
              </>
            ) : (
              <>
                Deposite R$ 50,00 e libere o{" "}
                <span>saque premium.</span>
              </>
            )}
          </h2>

          <p className="promo-v2-copy">
            {premiumEligible
              ? `Você já atingiu ${money(
                  premiumPlanMinDeposit,
                )} em depósitos confirmados desta promoção e pode solicitar saque fora da janela padrão.`
              : `Complete o valor mínimo em depósitos confirmados e desbloqueie a solicitação de saque fora da janela padrão. Você já possui ${money(
                  premiumDeposited,
                )}; faltam ${money(
                  premiumRemaining,
                )}.`}
          </p>

          <div
            className="premium-withdrawal-grid"
            aria-label="Benefícios do Plano Prêmio"
          >
            <article className="premium-withdrawal-card">
              <span className="premium-withdrawal-icon">
                <Wallet size={21} />
              </span>

              <small>Depósito mínimo</small>
              <strong>{money(premiumPlanMinDeposit)}</strong>
              <p>em depósitos confirmados</p>
            </article>

            <article className="premium-withdrawal-card">
              <span className="premium-withdrawal-icon">
                <Sparkles size={21} />
              </span>

              <small>Benefício</small>
              <strong>
                {premiumEligible
                  ? "Saque liberado"
                  : "Saque premium"}
              </strong>
              <p>fora da janela padrão</p>
            </article>
          </div>

          {!premiumEligible && (
            <div
              className="premium-withdrawal-progress"
              aria-label={`Progresso do Plano Prêmio: ${money(
                premiumDeposited,
              )} de ${money(premiumPlanMinDeposit)}`}
            >
              <div>
                <span>Seu progresso</span>
                <strong>
                  {money(premiumDeposited)} /{" "}
                  {money(premiumPlanMinDeposit)}
                </strong>
              </div>

              <progress
                value={Math.min(
                  premiumDeposited,
                  premiumPlanMinDeposit,
                )}
                max={premiumPlanMinDeposit}
              />
            </div>
          )}

          <div className="promo-v2-note">
            <ShieldCheck size={18} />
            <span>
              <strong>Plano Prêmio:</strong> após{" "}
              {money(premiumPlanMinDeposit)} em depósitos
              confirmados feitos desde o início da promoção,
              a conta pode solicitar saque fora da janela
              padrão de segunda a sexta, das 09:00 às 18:00.
              Dentro da janela padrão, seguem as regras normais
              de saque da plataforma.
            </span>
          </div>

          <div className="promo-v2-actions">
            <Link
              href={
                premiumEligible
                  ? "/carteira/saque"
                  : "/carteira/deposito"
              }
              className="button primary"
              onClick={close}
            >
              {premiumEligible
                ? "Solicitar saque"
                : "Quero liberar"}
              <ArrowUpRight size={18} />
            </Link>

            <Link
              href={
                premiumEligible
                  ? "/carteira"
                  : "/carteira/saque"
              }
              className="button outline"
              onClick={close}
            >
              {premiumEligible
                ? "Ver carteira"
                : "Ver regras do saque"}
            </Link>
          </div>
        </div>

        <div
          className="promo-v2-hero premium-withdrawal-hero"
          aria-hidden="true"
        >
          <Image
            src="/solar-8.png"
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 420px"
          />

          <div className="promo-v2-hero-shade" />

          <div className="promo-v2-hero-copy">
            <span>ENERGYINVEST</span>
            <strong>
              {premiumEligible
                ? "Plano Prêmio liberado para sua conta."
                : "Mais liberdade para sacar com o Plano Prêmio."}
            </strong>
            <small>
              {premiumEligible
                ? "Seu benefício promocional está ativo."
                : "Condição promocional disponível agora."}
            </small>
          </div>
        </div>
      </section>
    </div>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data } = useApp();
  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        <p className="nav-caption">SEU ESPAÇO SOLAR</p>
        <BottomNavigation />
        <div className="sidebar-bottom">
          <div className="eco-note">
            <Sun size={24} />
            <strong>O futuro é renovável.</strong>
            <p>Faça parte de uma nova forma de acompanhar energia.</p>
            <Link href="/projetos">
              Explorar projetos <ArrowUpRight size={17} />
            </Link>
          </div>
          <span>
            <ShieldCheck size={15} /> Conexão protegida
          </span>
        </div>
      </aside>
      <div className="main-shell">
        <LaunchTicker />
        <AppHeader />
        <main id="main-content" className="content">
          {data.demo && (
            <div className="demo-banner">
              <span className="demo-dot" />
              <span>
                Modo demonstração <b>·</b> sem dinheiro real
              </span>
              <Link href="/login">
                Minha conta <ArrowUpRight size={13} />
              </Link>
            </div>
          )}
          {children}
          <footer className="page-footer">
            <ShieldCheck size={14} />
            <span>EnergyInvest · Energia com transparência</span>
          </footer>
        </main>
      </div>
      <div className="mobile-navigation">
        <BottomNavigation />
      </div>
      {["/", "/projetos", "/meus-paineis"].includes(path) && (
        <WhatsAppFloatingButton />
      )}
      <LaunchWelcomeModal />
    </div>
  );
}
export function LogoutButton() {
  const router = useRouter();
  const { toast } = useApp();
  return (
    <button
      className="menu-item danger"
      onClick={async () => {
        try {
          await performAction({ action: "logout" });
          router.push("/login");
          router.refresh();
        } catch (e) {
          toast((e as Error).message, true);
        }
      }}
    >
      <LogOut size={20} />
      Sair da conta
    </button>
  );
}
