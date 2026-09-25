"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Eye,
  EyeOff,
  Sun,
  PanelsTopLeft,
  TrendingUp,
  ArrowRight,
  Leaf,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react";
import { useApp } from "./shell";
import { money } from "@/lib/format";
import { PageTitle, SectionTitle, EmptyState } from "./ui";
import { SolarProjectCard, UserSolarProjectCard } from "./projects";
export function WalletCard() {
  const { data } = useApp();
  const [visible, setVisible] = useState(true);
  const total = data.holdings.reduce((s, h) => s + h.amountInvested, 0);
  const pendingCredits = data.credits
    .filter((credit) => credit.status === "pending")
    .reduce((sum, credit) => sum + credit.amount, 0);
  const nextCredit = data.credits
    .filter((credit) => credit.status === "pending")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
  const nextCreditLabel = nextCredit
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(nextCredit.scheduledAt))
    : "Nenhum crédito pendente";
  return (
    <section className="wallet-card">
      <div className="wallet-top">
        <span>
          <span className="wallet-dot" /> MINHA CARTEIRA
        </span>
        <button
          aria-label={visible ? "Ocultar saldo" : "Mostrar saldo"}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <Eye size={19} /> : <EyeOff size={19} />}
        </button>
      </div>
      <p>Saldo disponível</p>
      <h2>{visible ? money(data.wallet.balance) : "R$ ••••"}</h2>
      <div className="wallet-submetrics">
        <div>
          <span>Rendimentos acumulados</span>
          <strong>{visible ? money(data.wallet.totalEarned) : "••••"}</strong>
        </div>
        <div>
          <span>Total aplicado{data.demo ? " · simulado" : ""}</span>
          <strong>{visible ? money(total) : "••••"}</strong>
        </div>
      </div>
      <div className="wallet-future">
        <div>
          <span>Saldo futuro</span>
          <strong>{visible ? money(pendingCredits) : "R$ ••••"}</strong>
        </div>
        <small>Próximo crédito: {nextCreditLabel}</small>
      </div>
      <div className="wallet-buttons">
        <Link href="/carteira/deposito" className="button light">
          <Plus size={19} />
          Adicionar saldo
        </Link>
        <Link href="/carteira/saque" className="button ghost-light">
          <ArrowUpRight size={19} />
          Sacar
        </Link>
      </div>
      <Sun className="wallet-sun" size={220} strokeWidth={0.7} />
    </section>
  );
}
export function Dashboard() {
  const { data, refresh, toast } = useApp();
  const [visibleProjects, setVisibleProjects] = useState(6);
  const availableProjects = data.projects.filter((p) => p.status === "available");
  const first = data.profile.name.split(" ")[0];
  const active = data.holdings.filter((h) => h.status === "active").length;
  const today = data.transactions
    .filter(
      (t) =>
        t.type === "credit" &&
        t.status === "completed" &&
        t.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10),
    )
    .reduce((s, t) => s + t.amount, 0);
  return (
    <>
      <PageTitle
        eyebrow="BEM-VINDO À ENERGYINVEST"
        title={`Olá, ${first}. ☀`}
        description="Acompanhe sua energia. Cultive seu futuro."
      >
        <button
          className="icon-button refresh"
          aria-label="Atualizar informações"
          onClick={() => {
            refresh();
            toast("Informações atualizadas.");
          }}
        >
          <RefreshCw size={18} />
        </button>
      </PageTitle>
      <div className="dashboard-top">
        <WalletCard />
        <section className="solar-story">
          <Image
            src="/solar-1.jpg"
            fill
            sizes="(max-width: 768px) 100vw, 550px"
            alt="Painéis solares em um campo verde"
            priority
          />
          <div className="story-content">
            <span>
              <Leaf size={14} /> ENERGIA QUE TRANSFORMA
            </span>
            <h2>
              O amanhã começa
              <br />
              com um raio de sol.
            </h2>
            <p>
              Conheça os projetos que conectam você
              <br className="desktop-only" /> a um futuro mais sustentável.
            </p>
            <Link href="/projetos">
              Encontre seu projeto <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>
      </div>
      <div className="stats-grid">
        <Stat
          icon={<Sun size={22} />}
          title="Rendimento hoje"
          value={money(today)}
          note="Créditos registrados"
        />
        <Stat
          icon={<TrendingUp size={22} />}
          title="Rendimento total"
          value={money(data.wallet.totalEarned)}
          note="Ao longo da sua jornada"
          green
        />
        <Stat
          icon={<PanelsTopLeft size={22} />}
          title="Projetos ativos"
          value={String(active).padStart(2, "0")}
          note="Acompanhe em Meus painéis"
        />
      </div>
      <div className="featured-projects-heading">
        <span className="featured-projects-badge">DESTAQUES</span>
        <SectionTitle
          title="Painéis em destaque"
          href="/projetos"
          label="Explorar todos"
        />
      </div>
      <p className="section-description">
        Escolha o próximo capítulo da sua jornada solar.
      </p>
      <div className="project-grid">
        {availableProjects.slice(0, visibleProjects).map((p) => (
          <SolarProjectCard key={p.id} project={p} />
        ))}
      </div>
      {availableProjects.length > visibleProjects && (
        <div className="project-load-more">
          <button
            type="button"
            className="button outline"
            onClick={() => setVisibleProjects((count) => count + 6)}
          >
            Carregar mais painéis
            <ArrowDownLeft size={17} className="load-more-arrow" />
          </button>
          <span>
            Mostrando {Math.min(visibleProjects, availableProjects.length)} de {availableProjects.length}
          </span>
        </div>
      )}
      <div className="transparency-strip">
        <ShieldCheck size={24} />
        <div>
          <strong>Transparência em cada etapa</strong>
          <p>
            Acompanhe valores, períodos e créditos programados de cada projeto
            diretamente pela plataforma.
          </p>
        </div>
        <Link href="/perfil/termos" aria-label="Entender os termos">
          <ArrowRight size={22} />
        </Link>
      </div>
    </>
  );
}
export function Stat({
  icon,
  title,
  value,
  note,
  green = false,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  note?: string;
  green?: boolean;
}) {
  return (
    <div className="stat">
      <span className={`stat-icon ${green ? "green" : ""}`}>{icon}</span>
      <div>
        <span className="stat-label">{title}</span>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
      </div>
    </div>
  );
}
export function ProjectsPage() {
  const { data } = useApp();
  const [state, setState] = useState("Todos");
  const [tab, setTab] = useState("Todos os painéis");
  const [query, setQuery] = useState("");
  const list = data.projects.filter(
    (p) =>
      (state === "Todos" || p.state === state) &&
      (!query ||
        `${p.name} ${p.city}`.toLowerCase().includes(query.toLowerCase())) &&
      (tab === "Todos os painéis" ||
        (tab === "Ativos" && ["active", "available"].includes(p.status)) ||
        (tab === "Novos" && p.isNew) ||
        (tab === "Encerrando" &&
          p.availableUnits > 0 &&
          p.availableUnits <= 32)),
  );
  return (
    <>
      <PageTitle
        eyebrow="ENCONTRE SUA PRÓXIMA OPORTUNIDADE"
        title="Painéis solares"
        description="Do painel inicial de R$ 50 aos painéis internacionais de maior porte."
      />
      <div className="catalog-toolbar">
        <label className="search-input">
          <Search size={19} />
          <input
            aria-label="Buscar por projeto ou cidade"
            placeholder="Buscar por projeto ou cidade"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="filter-label">
          <SlidersHorizontal size={17} />
          Filtrar projetos
        </span>
      </div>
      <div className="filter-scroll" aria-label="Filtrar por estado">
        {["Todos", "SP", "RJ", "MG", "BA", "CE", "PE", "GO", "PR", "RS", "Europa", "EUA", "China"].map(
          (s) => (
            <button
              className={`chip ${state === s ? "active" : ""}`}
              aria-pressed={state === s}
              key={s}
              onClick={() => setState(s)}
            >
              {s}
            </button>
          ),
        )}
      </div>
      <div className="catalog-meta">
        <div className="tabs">
          {["Todos os painéis", "Ativos", "Novos", "Encerrando"].map((t) => (
            <button
              aria-pressed={tab === t}
              className={t === tab ? "active" : ""}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <span>{list.length} painéis</span>
      </div>
      {list.length ? (
        <div className="project-grid">
          {list.map((p) => (
            <SolarProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Novos horizontes estão chegando"
          description="Nenhum projeto corresponde aos filtros. Experimente outro estado ou termo de busca."
        />
      )}
      <p className="disclaimer centered">
        Imagens ilustrativas. Consulte o período e a programação de créditos de
        cada projeto antes de participar.
      </p>
    </>
  );
}
export function HoldingsPage() {
  const { data } = useApp();
  const [tab, setTab] = useState("Ativos");
  const total = data.holdings.reduce((s, h) => s + h.amountInvested, 0);
  const received = data.holdings.reduce((s, h) => s + h.totalReceived, 0);
  const projected = data.holdings.reduce(
    (s, h) =>
      s +
      (data.projects.find((p) => p.id === h.projectId)?.projectedTotalReturn ??
        0) *
        h.quantity,
    0,
  );
  const list = data.holdings.filter(
    (h) =>
      tab === "Todos" ||
      h.status === (tab === "Ativos" ? "active" : "finished"),
  );
  return (
    <>
      <PageTitle
        eyebrow="SUA JORNADA SOLAR"
        title="Meus painéis"
        description="Cada projeto, cada etapa. Tudo por aqui."
      />
      <div className="stats-grid four">
        <Stat
          icon={<PanelsTopLeft size={21} />}
          title="Investimento total"
          value={money(total)}
        />
        <Stat
          icon={<ArrowDownLeft size={21} />}
          title="Créditos recebidos"
          value={money(received)}
          green
        />
        <Stat
          icon={<TrendingUp size={21} />}
          title="Créditos previstos"
          value={money(Math.max(0, projected - received))}
        />
        <Stat
          icon={<Sun size={21} />}
          title="Projetos ativos"
          value={String(
            data.holdings.filter((h) => h.status === "active").length,
          )}
        />
      </div>
      {data.demo && (
        <p className="disclaimer">
          Participações simuladas, sem valor financeiro. O progresso acompanha
          as datas configuradas de cada projeto.
        </p>
      )}
      <div className="tabs page-tabs">
        {["Ativos", "Concluídos", "Todos"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="holdings-list">
          {list.map((h) => (
            <UserSolarProjectCard key={h.id} holding={h} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            tab === "Concluídos"
              ? "Sua história ainda está começando"
              : "Seu primeiro painel espera por você"
          }
          description={
            tab === "Concluídos"
              ? "Os projetos finalizados aparecerão aqui."
              : "Explore os projetos disponíveis e acompanhe sua primeira participação."
          }
          href="/projetos"
          label="Explorar projetos"
        />
      )}
    </>
  );
}
