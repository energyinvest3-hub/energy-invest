"use client";
import { useState } from "react";
import Link from "next/link";
import {
  UserRound,
  ShieldCheck,
  Wallet,
  PanelsTopLeft,
  History,
  Bell,
  LockKeyhole,
  FileText,
  Headphones,
  ChevronRight,
  Check,
  Clock3,
  Sun,
  ArrowUpRight,
  Target,
  LifeBuoy,
  Settings,
  Gift,
  ArrowLeftRight,
  UserPlus,
  CreditCard,
  UsersRound,
  CalendarDays,
  CalendarCheck,
  TicketPercent,
  Handshake,
  ClipboardCheck,
  Building2,
  Copy,
  Share2,
  BadgeCheck,
  CircleDollarSign,
} from "lucide-react";
import { useApp, LogoutButton } from "./shell";
import { PageTitle, InvestmentProgress, Busy, EmptyState } from "./ui";
import { ProjectImage } from "./projects";
import { money, date } from "@/lib/format";
import { performAction } from "@/services/projects";
import type { AppNotification } from "@/lib/types";
import { goalProgress } from "@/lib/goals";
const menu = [
  ["Dados pessoais", "/perfil/dados", UserRound],
  ["Segurança", "/perfil/seguranca", ShieldCheck],
  ["Minha carteira", "/carteira", Wallet],
  ["Meus painéis", "/meus-paineis", PanelsTopLeft],
  ["Histórico", "/carteira", History],
  ["Notificações", "/notificacoes", Bell],
  ["Privacidade", "/perfil/privacidade", LockKeyhole],
  ["Termos de uso", "/perfil/termos", FileText],
  ["Suporte", "/perfil/suporte", Headphones],
] as const;
const shortcuts = [
  ["Intercâmbio", "/perfil/intercambio", ArrowLeftRight],
  ["Convidar", "/perfil/convites", UserPlus],
  ["PIX", "/carteira", CreditCard],
  ["Equipe", "/perfil/equipe", UsersRound],
  ["Salário semanal", "/perfil/salario-semanal", CalendarDays],
  ["Receber salário", "/perfil/receber-salario", CalendarCheck],
  ["Rendimento solar", "/meus-paineis", Sun],
  ["Cupom", "/perfil/cupom", TicketPercent],
  ["Recompensas por convite", "/perfil/recompensas", Handshake],
  ["Central de tarefas", "/perfil/metas", ClipboardCheck],
  ["Política de privacidade", "/perfil/privacidade", ShieldCheck],
  ["Sobre nós", "/perfil/sobre", Building2],
  ["Atendimento ao cliente", "/perfil/suporte", LifeBuoy],
  ["Configurações", "/perfil/dados", Settings],
] as const;
export function ProfilePage() {
  const { data } = useApp();
  const goals = data.goalDefinitions.filter((goal) => goal.active);
  const completed = goals.filter(
    (goal) => goalProgress(goal, data.holdings).achieved,
  ).length;
  const progress = goals.length
    ? Math.round((completed / goals.length) * 100)
    : 0;
  return (
    <div className="narrow">
      <PageTitle
        eyebrow="DO SEU JEITO"
        title="Meu perfil"
        description="Sua conta e tudo o que importa."
      />
      <section className="surface profile-card">
        <div className="avatar">{data.profile.name.charAt(0)}</div>
        <h2>{data.profile.name}</h2>
        <p>{data.profile.email || "Explorando uma energia diferente"}</p>
        <span className="pill green">
          <ShieldCheck size={14} />
          {data.demo ? "Conta demonstrativa" : "Conta pessoal"}
        </span>
        <small>ID: {data.profile.id}</small>
      </section>
      <section className="surface profile-progress-card">
        <div>
          <span className="eyebrow">SUA JORNADA</span>
          <h2>
            {completed} de {goals.length} metas atingidas
          </h2>
          <p>Acompanhe seus painéis, o tempo de participação e seus bônus.</p>
        </div>
        <div
          className="profile-progress-ring"
          style={{ "--progress": `${progress}%` } as React.CSSProperties}
          aria-label={`${progress}% das metas concluídas`}
        >
          <strong>{progress}%</strong>
        </div>
        <progress
          value={completed}
          max={goals.length || 1}
          aria-label="Progresso das metas"
        />
        <Link className="profile-progress-link" href="/perfil/metas">
          Ver central de metas <ChevronRight size={17} />
        </Link>
      </section>
      <section
        className="surface profile-shortcuts"
        aria-label="Atalhos da conta"
      >
        {shortcuts.map(([label, href, Icon]) => (
          <Link key={label} href={href}>
            <span>
              <Icon size={22} />
            </span>
            <strong>{label}</strong>
          </Link>
        ))}
      </section>
      <section className="surface menu-list">
        {menu.map(([label, href, Icon]) => (
          <Link className="menu-item" key={href + label} href={href}>
            <Icon size={20} />
            <span>{label}</span>
            <ChevronRight size={17} />
          </Link>
        ))}
        {data.profile.role === "ADMIN" && (
          <Link className="menu-item" href="/admin">
            <ShieldCheck size={20} />
            Administração
            <ChevronRight size={17} />
          </Link>
        )}
        <LogoutButton />
      </section>
      <p className="disclaimer centered">EnergyInvest · versão 1.0</p>
    </div>
  );
}

export function GoalsPage() {
  const { data, toast, refresh } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const goals = data.goalDefinitions
    .filter((goal) => goal.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((goal) => ({
      ...goal,
      progress: goalProgress(goal, data.holdings),
      reward: data.rewards.find((reward) => reward.goalKey === goal.key),
    }));
  const totalDone = goals.filter((goal) => goal.progress.achieved).length;

  async function claim(goalKey: string) {
    setBusy(goalKey);
    try {
      const result = await performAction({ action: "claimReward", goalKey });
      toast(result.message);
      refresh();
    } catch (error) {
      toast((error as Error).message, true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="narrow goals-page">
      <PageTitle
        eyebrow="PASSO A PASSO"
        title="Central de metas"
        description="Marcos do seu portfólio que liberam bônus configurados pela plataforma."
        back="/perfil"
      />
      <section className="goals-hero">
        <Target size={28} />
        <div>
          <span>PROGRESSO DA JORNADA</span>
          <strong>
            {totalDone} de {goals.length} concluídas
          </strong>
        </div>
        <b>{goals.length ? Math.round((totalDone / goals.length) * 100) : 0}%</b>
        <progress value={totalDone} max={goals.length || 1} />
      </section>
      <div className="goals-list">
        {goals.map((goal) => {
          return (
            <article
              className={`goal-card ${goal.progress.achieved ? "done" : ""}`}
              key={goal.key}
            >
              <span className="goal-icon">
                {goal.progress.achieved ? (
                  <Check size={21} />
                ) : goal.criterionType === "panel_count" ? (
                  <PanelsTopLeft size={21} />
                ) : (
                  <Clock3 size={21} />
                )}
              </span>
              <div>
                <span className="goal-state">
                  {goal.progress.achieved ? "META ATINGIDA" : "EM PROGRESSO"}
                </span>
                <h2>{goal.title}</h2>
                <p>{goal.description}</p>
                <div className="goal-meter">
                  <span>
                    {goal.progress.current} de {goal.progress.target}{" "}
                    {goal.criterionType === "panel_count"
                      ? "painéis"
                      : "dias"}
                  </span>
                  <strong>{goal.progress.percent}%</strong>
                  <progress
                    value={goal.progress.current}
                    max={goal.progress.target}
                  />
                </div>
                <div className="goal-reward">
                  <Gift size={16} />
                  <span>Bônus</span>
                  <strong>{money(goal.bonusAmount)}</strong>
                </div>
                {goal.reward ? (
                  <span
                    className={`pill ${goal.reward.status === "credited" ? "green" : "orange"}`}
                  >
                    {goal.reward.status === "credited"
                      ? "Bônus creditado"
                      : goal.reward.status === "cancelled"
                        ? "Bônus cancelado"
                        : "Bônus em validação"}
                  </span>
                ) : goal.progress.achieved ? (
                  <button
                    className="button small primary goal-action"
                    disabled={busy === goal.key}
                    onClick={() => claim(goal.key)}
                  >
                    {busy === goal.key ? "Validando…" : "Solicitar bônus"}
                    <Gift size={15} />
                  </button>
                ) : (
                  <Link className="text-button goal-action" href="/projetos">
                    Ver projetos <ChevronRight size={16} />
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <div className="info-box goals-note">
        <Gift size={20} />
        <p>
          Os bônus são promocionais, têm valor configurável e só entram no saldo
          após validação do servidor. No modo demonstrativo, a solicitação é
          apenas uma simulação e não gera dinheiro real.
        </p>
      </div>
    </div>
  );
}
export function ProfileSubpage({ section }: { section: string }) {
  const { data, toast, refresh } = useApp();
  const [name, setName] = useState(data.profile.name);
  const [phone, setPhone] = useState(data.profile.phone);
  const [busy, setBusy] = useState(false);
  const titles: Record<string, string> = {
    dados: "Dados pessoais",
    seguranca: "Segurança",
    privacidade: "Política de privacidade",
    termos: "Termos de uso",
    suporte: "Como podemos ajudar?",
    intercambio: "Intercâmbio de projetos",
    convites: "Convidar pessoas",
    equipe: "Minha equipe",
    "salario-semanal": "Salário semanal",
    "receber-salario": "Receber salário",
    cupom: "Cupons",
    recompensas: "Recompensas por convite",
    sobre: "Sobre a EnergyInvest",
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await performAction({ action: "profile", name, phone });
      toast(r.message);
      refresh();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="narrow">
      <PageTitle
        title={titles[section] ?? "Página não encontrada"}
        back="/perfil"
      />
      <section className="surface">
        {section === "dados" ? (
          <form onSubmit={save}>
            <label className="field">
              Nome completo
              <input
                required
                minLength={3}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
            <label className="field">
              Telefone
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
              />
            </label>
            <label className="field">
              E-mail
              <input
                value={data.profile.email}
                disabled
                placeholder="Disponível após criar sua conta"
              />
            </label>
            <button className="button primary full" disabled={busy}>
              <Busy loading={busy}>Salvar alterações</Busy>
            </button>
          </form>
        ) : section === "seguranca" ? (
          <>
            <div className="form-icon">
              <ShieldCheck size={28} />
            </div>
            <h2>Senha e acesso</h2>
            <p>
              Para proteger sua conta, a troca de senha é confirmada pelo seu
              e-mail cadastrado. Você recebe um link seguro e define uma nova senha.
            </p>
            <Link className="button primary full" href="/recuperar-senha">
              Alterar minha senha
              <ArrowUpRight size={17} />
            </Link>
            <div className="info-box" style={{ marginTop: 16 }}>
              <LockKeyhole size={18} />
              <p>O link é de uso único. Se expirar, basta solicitar outro.</p>
            </div>
          </>
        ) : section === "suporte" ? (
          <>
            <div className="form-icon">
              <Headphones size={28} />
            </div>
            <h2>Vamos conversar</h2>
            <p>
              Para tirar dúvidas sobre projetos, participações e sua conta,
              acesse a comunidade.
            </p>
            <a
              className="button primary full"
              href={process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL || "https://wa.me/5511977692699"}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir WhatsApp
              <ArrowUpRight size={17} />
            </a>
            <h3>Perguntas frequentes</h3>
            <details open>
              <summary>Os retornos são garantidos?</summary>
              <p>
                Sim, os créditos programados do projeto são liberados conforme a
                operação da plataforma e ficam visíveis na sua carteira.
              </p>
            </details>
          </>
        ) : section === "privacidade" || section === "termos" ? (
          <LegalCopy section={section} />
        ) : (
          <ProfileFeature section={section} />
        )}
      </section>
    </div>
  );
}
function ProfileFeature({ section }: { section: string }) {
  if (["convites", "equipe", "recompensas"].includes(section)) {
    return <ReferralProgramFeature section={section} />;
  }
  const content: Record<
    string,
    { title: string; description: string; href?: string; label?: string }
  > = {
    intercambio: {
      title: "Projetos em diferentes regiões",
      description:
        "Consulte projetos nacionais e cenários internacionais no catálogo. Moeda, tributação, documentação e operação internacional ainda precisam de validação antes do lançamento.",
      href: "/projetos",
      label: "Explorar projetos",
    },
    "salario-semanal": {
      title: "Calendário semanal de créditos",
      description:
        "Este nome reproduz o atalho solicitado, mas créditos de projetos não constituem salário nem vínculo de emprego. O cronograma real aparece em Meus painéis.",
      href: "/meus-paineis",
      label: "Ver cronogramas",
    },
    "receber-salario": {
      title: "Recebimento de créditos",
      description:
        "Créditos validados são registrados na carteira conforme o cronograma de cada projeto. Eles não são salário e permanecem sujeitos às regras e ao resultado do projeto.",
      href: "/carteira",
      label: "Abrir carteira",
    },
    cupom: {
      title: "Cupons promocionais",
      description:
        "Nenhum cupom está ativo nesta versão. A futura ativação deverá informar validade, benefício e condições de uso com clareza.",
    },
    sobre: {
      title: "Energia com transparência",
      description:
        "A EnergyInvest é uma interface em desenvolvimento para acompanhar participações em projetos solares. Projetos internacionais exibidos agora são cenários ilustrativos, não instalações verificadas.",
    },
  };
  const item = content[section];
  if (!item)
    return (
      <EmptyState
        title="Página não encontrada"
        description="Este recurso não está disponível."
        href="/perfil"
        label="Voltar ao perfil"
      />
    );
  return (
    <div className="legal-copy">
      <span className="pill orange">EM PREPARAÇÃO</span>
      <h2>{item.title}</h2>
      <p>{item.description}</p>
      {item.href && (
        <Link className="button primary full" href={item.href}>
          {item.label} <ArrowUpRight size={17} />
        </Link>
      )}
    </div>
  );
}

function ReferralProgramFeature({ section }: { section: string }) {
  const { data, toast } = useApp();
  const referral = data.referral;
  const [copied, setCopied] = useState(false);

  function referralUrl() {
    if (typeof window === "undefined") return `/cadastro?ref=${referral.inviteCode}`;
    return `${window.location.origin}/cadastro?ref=${referral.inviteCode}`;
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(referral.inviteCode);
      setCopied(true);
      toast("Código de convite copiado.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Não foi possível copiar o código.", true);
    }
  }

  async function shareInvite() {
    const url = referralUrl();
    const text = `Entre na EnergyInvest com meu código ${referral.inviteCode}: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Convite EnergyInvest", text, url });
      } else {
        await navigator.clipboard.writeText(text);
        toast("Link de convite copiado.");
      }
    } catch {
      // O usuário pode simplesmente ter fechado a folha de compartilhamento.
    }
  }

  if (!referral.active) {
    return (
      <EmptyState
        title="Programa temporariamente indisponível"
        description="As indicações estão pausadas no momento."
        href="/perfil"
        label="Voltar ao perfil"
      />
    );
  }

  if (section === "convites") {
    return (
      <div className="referral-program">
        <div className="referral-hero">
          <span className="pill green"><UserPlus size={14} /> PROGRAMA ATIVO</span>
          <h2>Convide e ganhe {money(referral.rewardAmount)}</h2>
          <p>
            Você recebe um bônus único quando seu convidado realiza a primeira
            compra elegível de pelo menos {money(referral.minPurchaseAmount)}.
          </p>
        </div>
        <div className="referral-code-card">
          <span>SEU CÓDIGO</span>
          <strong>{referral.inviteCode}</strong>
          <div className="referral-actions">
            <button className="button outline" type="button" onClick={copyCode}>
              <Copy size={17} /> {copied ? "Copiado" : "Copiar código"}
            </button>
            <button className="button primary" type="button" onClick={shareInvite}>
              <Share2 size={17} /> Compartilhar
            </button>
          </div>
        </div>
        <div className="referral-stat-grid">
          <div><UsersRound size={20} /><span>Convidados</span><strong>{referral.invitedCount}</strong></div>
          <div><BadgeCheck size={20} /><span>Qualificados</span><strong>{referral.qualifiedCount}</strong></div>
          <div><CircleDollarSign size={20} /><span>Bônus recebidos</span><strong>{money(referral.totalBonus)}</strong></div>
        </div>
        <div className="info-box">
          <ShieldCheck size={19} />
          <p>O bônus é promocional, é liberado uma única vez por convidado elegível e aparece no histórico da carteira.</p>
        </div>
      </div>
    );
  }

  if (section === "equipe") {
    return (
      <div className="referral-program">
        <div className="referral-hero">
          <span className="eyebrow">SUA REDE</span>
          <h2>{referral.invitedCount} pessoa{referral.invitedCount === 1 ? "" : "s"} indicada{referral.invitedCount === 1 ? "" : "s"}</h2>
          <p>Aqui aparecem apenas pessoas que criaram a conta usando seu código de convite.</p>
        </div>
        {referral.referrals.length === 0 ? (
          <EmptyState
            title="Sua rede começa no primeiro convite"
            description="Compartilhe seu código para acompanhar suas indicações aqui."
            href="/perfil/convites"
            label="Convidar agora"
          />
        ) : (
          <div className="referral-list">
            {referral.referrals.map((member) => (
              <div className="referral-member" key={member.id}>
                <span className="avatar small">{member.name.charAt(0).toUpperCase()}</span>
                <div>
                  <strong>{member.name}</strong>
                  <small>Entrou em {date(member.joinedAt)}</small>
                </div>
                <span className={`pill ${member.qualified ? "green" : "orange"}`}>
                  {member.qualified ? "Bônus liberado" : "Aguardando compra"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="referral-program">
      <div className="referral-hero">
        <span className="eyebrow">RECOMPENSAS</span>
        <h2>{money(referral.totalBonus)} em bônus de indicação</h2>
        <p>
          Cada convidado pode liberar {money(referral.rewardAmount)} uma única vez
          após a primeira compra de pelo menos {money(referral.minPurchaseAmount)}.
        </p>
      </div>
      <div className="referral-stat-grid two">
        <div><BadgeCheck size={20} /><span>Bônus liberados</span><strong>{referral.qualifiedCount}</strong></div>
        <div><Wallet size={20} /><span>Total recebido</span><strong>{money(referral.totalBonus)}</strong></div>
      </div>
      <Link className="button primary full" href="/perfil/convites">
        Convidar pessoas <ArrowUpRight size={17} />
      </Link>
    </div>
  );
}

export function LegalCopy({ section }: { section: string }) {
  return (
    <div className="legal-copy">
      <span className="pill orange">VERSÃO PRELIMINAR</span>
      {section === "privacidade" ? (
        <>
          <h2>Seus dados merecem cuidado.</h2>
          <p>
            Nome, e-mail e telefone são usados para identificação da conta,
            segurança e atendimento dentro da plataforma.
          </p>
          <h3>Armazenamento e acesso</h3>
          <p>
            A autenticação é gerenciada pelo Supabase. A aplicação não armazena
            senhas manualmente. Os registros de cada usuário são protegidos por
            políticas de acesso no banco.
          </p>
          <h3>Seus direitos</h3>
          <p>
            Você pode solicitar acesso, correção e atendimento sobre seus dados
            pelos canais disponibilizados na plataforma.
          </p>
        </>
      ) : (
        <>
          <h2>Informação antes de participação.</h2>
          <p>
            Consulte os dados, o período, a quantidade de cotas e a programação
            de créditos de cada projeto antes de confirmar uma participação.
          </p>
          <h3>Créditos dos projetos</h3>
          <p>
            Os créditos programados seguem o período e os valores exibidos em
            cada projeto e ficam registrados no histórico da carteira conforme
            são liberados.
          </p>
          <h3>Pagamentos e saques</h3>
          <p>
            Recargas confirmadas entram na carteira após a confirmação do PIX.
            Solicitações de saque seguem a janela diária informada na tela de
            saque e ficam registradas no histórico da conta.
          </p>
        </>
      )}
      <p className="disclaimer">
        Consulte sempre as condições exibidas na plataforma.
      </p>
    </div>
  );
}
export function NotificationItem({
  notification: n,
}: {
  notification: AppNotification;
}) {
  const { toast, refresh } = useApp();
  return (
    <button
      className={`notification-item ${n.read ? "" : "unread"}`}
      onClick={async () => {
        try {
          await performAction({ action: "read", id: n.id });
          refresh();
        } catch (e) {
          toast((e as Error).message, true);
        }
      }}
    >
      <span className="notification-icon">
        <Sun size={21} />
      </span>
      <span>
        <strong>{n.title}</strong>
        <p>{n.message}</p>
        <small>{date(n.createdAt)}</small>
      </span>
      {!n.read && <i />}
    </button>
  );
}
export function NotificationsPage() {
  const { data, toast, refresh } = useApp();
  return (
    <div className="narrow">
      <PageTitle
        title="Notificações"
        description="As novidades da sua jornada solar."
      />
      <div className="section-title">
        <span>
          {data.notifications.filter((n) => !n.read).length} não lidas
        </span>
        <button
          className="text-button"
          onClick={async () => {
            try {
              await performAction({ action: "read", id: "all" });
              refresh();
            } catch (e) {
              toast((e as Error).message, true);
            }
          }}
        >
          Marcar todas como lidas
        </button>
      </div>
      <section className="surface notifications">
        {data.notifications.length ? (
          data.notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))
        ) : (
          <EmptyState
            title="Tudo em dia"
            description="Novidades e atualizações dos seus projetos aparecerão aqui."
          />
        )}
      </section>
    </div>
  );
}
export function HoldingDetails({ id }: { id: string }) {
  const { data } = useApp();
  const h = data.holdings.find((h) => h.id === id);
  const p = data.projects.find((p) => p.id === h?.projectId);
  if (!h || !p)
    return (
      <EmptyState
        title="Painel não encontrado"
        description="Esta participação não está disponível na sua conta."
        href="/meus-paineis"
        label="Voltar aos painéis"
      />
    );
  return (
    <>
      <PageTitle
        title={p.name}
        back="/meus-paineis"
        description={`${p.city} · ${p.state}`}
      />
      <div className="project-detail-layout">
        <div>
          <ProjectImage project={p} large />
          <section className="surface">
            <div className="section-title">
              <h2>Sua participação</h2>
              <span className="pill green">
                {h.status === "active" ? "Ativo" : "Concluído"}
              </span>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Data da participação</dt>
                <dd>{date(h.createdAt)}</dd>
              </div>
              <div>
                <dt>Quantidade</dt>
                <dd>
                  {h.quantity} {h.quantity === 1 ? "cota" : "cotas"}
                </dd>
              </div>
              <div>
                <dt>Valor aplicado</dt>
                <dd>{money(h.amountInvested)}</dd>
              </div>
              <div>
                <dt>Créditos registrados</dt>
                <dd className="positive">{money(h.totalReceived)}</dd>
              </div>
              <div>
                <dt>Estimativa restante</dt>
                <dd>
                  {money(
                    Math.max(
                      0,
                      p.projectedTotalReturn * h.quantity - h.totalReceived,
                    ),
                  )}
                </dd>
              </div>
              <div>
                <dt>Estimativa total</dt>
                <dd>{money(p.projectedTotalReturn * h.quantity)}</dd>
              </div>
            </dl>
            <InvestmentProgress day={h.elapsedDays} total={p.durationDays} />
          </section>
        </div>
        <section className="surface">
          <h2>Linha do tempo</h2>
          <p>Previsão de créditos por dia do projeto.</p>
          <div className="timeline">
            {Array.from({ length: p.durationDays }, (_, i) => {
              const credit = data.credits?.find(
                (c) => c.userProjectId === h.id && c.creditNumber === i + 1,
              );
              const credited = credit?.status === "completed";
              return (
                <div
                  className={`timeline-item ${credited ? "credited" : ""}`}
                  key={i}
                >
                  <span className="timeline-icon">
                    {credited ? <Check size={17} /> : <Clock3 size={17} />}
                  </span>
                  <div>
                    <strong>Dia {i + 1}</strong>
                    <span>
                      {date(
                        new Date(
                          new Date(h.startedAt).getTime() + i * 86400000,
                        ).toISOString(),
                      )}
                    </span>
                  </div>
                  <div>
                    <strong>
                      {money(
                        credit?.amount ?? p.dailyProjectedReturn * h.quantity,
                      )}
                    </strong>
                    <span>
                      {credited
                        ? "Registrado"
                        : credit?.status === "cancelled"
                          ? "Cancelado"
                          : "Pendente"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="disclaimer">
            Créditos previstos não são garantia de recebimento.
            {data.demo
              ? " Nenhum crédito financeiro será gerado nesta demonstração."
              : ""}
          </p>
        </section>
      </div>
    </>
  );
}
