"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  MapPin,
  ArrowUpRight,
  Sun,
  CalendarDays,
  Layers,
  Minus,
  Plus,
  ShieldCheck,
  Check,
  Clock3,
  ChevronRight,
  Leaf,
} from "lucide-react";
import type { SolarProject, UserProject } from "@/lib/types";
import { money, date, projectStatus } from "@/lib/format";
import { purchaseProject } from "@/services/projects";
import { useApp } from "./shell";
import { Modal, Busy, InvestmentProgress, PageTitle } from "./ui";
export function ProjectImage({
  project,
  large = false,
}: {
  project: SolarProject;
  large?: boolean;
}) {
  return (
    <div className={`project-image ${large ? "large" : ""}`}>
      <Image
        src={project.image}
        unoptimized={project.image.startsWith("https://")}
        fill
        sizes={
          large
            ? "(max-width: 768px) 100vw, 800px"
            : "(max-width: 768px) 100vw, 400px"
        }
        alt={`Instalação solar ilustrativa · ${project.city}`}
        style={{ objectFit: "cover" }}
      />
      <span
        className={`status-badge ${project.status === "available" || project.status === "active" ? "green" : "gray"}`}
      >
        <span />
        {projectStatus[project.status]}
      </span>
      {project.isNew && <span className="new-badge">NOVO PROJETO</span>}
      <span className="image-location">
        <MapPin size={13} />
        {project.city}, {project.state}
      </span>
    </div>
  );
}
export function SolarProjectCard({ project }: { project: SolarProject }) {
  const { data } = useApp();
  const purchased = data.holdings.some((h) => h.projectId === project.id);
  const closed = ["finished", "sold_out", "paused"].includes(project.status);
  return (
    <article className="project-card">
      <Link href={`/projetos/${project.id}`} aria-label={`Ver ${project.name}`}>
        <ProjectImage project={project} />
      </Link>
      <div className="project-card-body">
        <div className="project-category">
          <Sun size={14} /> {project.international ? "PAINEL SOLAR INTERNACIONAL" : "PAINEL SOLAR"}{" "}
          <span>{project.durationDays} dias</span>
        </div>
        <Link href={`/projetos/${project.id}`}>
          <h3>{project.name}</h3>
        </Link>
        <div className="project-metrics">
          <div>
            <span>Entrada</span>
            <strong>{money(project.investmentAmount)}</strong>
          </div>
          <div>
            <span>Retorno projetado / dia</span>
            <strong className="positive">
              {money(project.dailyProjectedReturn)}
            </strong>
          </div>
        </div>
        <div className="project-estimate">
          <span>Projeção no período · {project.returnMultiplier.toFixed(1)}x</span>
          <strong>{money(project.projectedTotalReturn)}</strong>
        </div>
        <Link
          className={`button ${closed ? "disabled" : purchased ? "purchased" : "primary"} full`}
          href={`/projetos/${project.id}`}
        >
          {closed
            ? projectStatus[project.status]
            : purchased
              ? "Adquirido · ver projeto"
              : `Participar por ${money(project.investmentAmount)}`}
          <ArrowUpRight size={17} />
        </Link>
        <div className="card-foot">
          <Layers size={13} />
          {project.availableUnits} cotas disponíveis<span>·</span>
          <span>Créditos programados</span>
        </div>
      </div>
    </article>
  );
}
export function ConfirmPurchaseModal({
  project,
  onClose,
}: {
  project: SolarProject;
  onClose: () => void;
}) {
  const { data, refresh } = useApp();
  const [quantity, setQuantity] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const already = data.holdings
    .filter((h) => h.projectId === project.id)
    .reduce((s, h) => s + h.quantity, 0);
  const limit = Math.min(
    project.availableUnits,
    project.maxUnitsPerUser - already,
  );
  const insufficient =
    data.wallet.balance < project.investmentAmount * quantity;
  async function confirm() {
    setBusy(true);
    try {
      await purchaseProject(project.id, quantity);
      setSuccess(true);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={success ? "Sua participação está pronta" : "Revisar participação"}
      onClose={onClose}
    >
      {success ? (
        <div className="success-state">
          <div className="success-icon">
            <Check size={34} />
          </div>
          <h3>Um novo painel no seu caminho.</h3>
          <p>
            {data.demo
              ? "A simulação foi registrada, sem movimentar sua carteira."
              : "Sua participação foi registrada."}
          </p>
          <Link
            className="button primary full"
            onClick={onClose}
            href="/meus-paineis"
          >
            Acompanhar meus painéis <ArrowUpRight size={18} />
          </Link>
        </div>
      ) : (
        <>
          <div className="modal-project">
            <Sun size={28} />
            <div>
              <strong>{project.name}</strong>
              <p>
                {project.city} · {project.state}
              </p>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Valor por cota</dt>
              <dd>{money(project.investmentAmount)}</dd>
            </div>
            <div>
              <dt>Saldo disponível</dt>
              <dd>{money(data.wallet.balance)}</dd>
            </div>
          </dl>
          <div className="quantity-row">
            <span>
              Quantidade <small>Máximo: {Math.max(limit, 0)} cotas</small>
            </span>
            <div className="stepper">
              <button
                aria-label="Diminuir quantidade"
                disabled={quantity <= 1 || busy}
                onClick={() => setQuantity((q) => q - 1)}
              >
                <Minus size={17} />
              </button>
              <strong>{quantity}</strong>
              <button
                aria-label="Aumentar quantidade"
                disabled={quantity >= limit || busy}
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus size={17} />
              </button>
            </div>
          </div>
          <div className="total-row">
            <span>Total da participação</span>
            <strong>{money(project.investmentAmount * quantity)}</strong>
          </div>
          <div className="info-box">
            <ShieldCheck size={19} />
            <p>
              {data.demo
                ? "Você está em uma demonstração. A participação será simulada sem débito e não gera direito a rendimentos."
                : "Os créditos seguem a programação exibida no projeto e ficam visíveis na carteira conforme são liberados."}
            </p>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            Li e compreendi as informações deste projeto.
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {insufficient && !data.demo ? (
            <>
              <p className="field-error">Saldo insuficiente</p>
              <Link href="/carteira/deposito" className="button primary full">
                Adicionar saldo
              </Link>
            </>
          ) : (
            <button
              className="button primary full"
              disabled={!accepted || busy || limit < 1}
              onClick={confirm}
            >
              <Busy loading={busy}>
                {data.demo
                  ? "Confirmar participação simulada"
                  : "Confirmar participação"}
              </Busy>
            </button>
          )}
        </>
      )}
    </Modal>
  );
}
export function SolarProjectDetails({ id }: { id: string }) {
  const { data } = useApp();
  const p = data.projects.find((p) => p.id === id);
  const [open, setOpen] = useState(false);
  if (!p) return <PageTitle title="Projeto não encontrado" back="/projetos" />;
  const closed = !["available", "active"].includes(p.status);
  return (
    <>
      <PageTitle title="Conheça seu próximo projeto" back="/projetos" />
      <div className="project-detail-layout">
        <div>
          <ProjectImage project={p} large />
          <div className="detail-heading">
            <span className="eyebrow">
              <Sun size={15} /> {p.international ? "PAINEL SOLAR INTERNACIONAL" : "PAINEL SOLAR"}
            </span>
            <h1>{p.name}</h1>
            <p>
              <MapPin size={16} />
              {p.city} · {p.state}
            </p>
          </div>
          <section className="surface">
            <h2>Sobre o projeto</h2>
            <p>{p.description}</p>
            <div className="benefit">
              <Leaf size={21} />
              <span>Geração renovável com acompanhamento transparente.</span>
            </div>
          </section>
          <section className="surface">
            <h2>Como funciona</h2>
            <ol className="how-it-works">
              {[
                "Você participa do projeto.",
                "Sua participação aparece em Meus painéis.",
                "O projeto entra em período ativo.",
                "Os créditos do projeto são registrados durante o período.",
                "Ao finalizar, o projeto aparece como concluído.",
              ].map((s, i) => (
                <li key={s}>
                  <span>{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div>
          <section className="surface investment-summary">
            <span className="eyebrow">SUA PARTICIPAÇÃO</span>
            <p>Valor por cota</p>
            <h2 className="big-money">{money(p.investmentAmount)}</h2>
            <dl className="detail-list">
              <div>
                <dt>
                  <Sun size={16} />
                  Estimativa diária
                </dt>
                <dd className="positive">{money(p.dailyProjectedReturn)}</dd>
              </div>
              <div>
                <dt>
                  <CalendarDays size={16} />
                  Período
                </dt>
                <dd>{p.durationDays} dias</dd>
              </div>
              <div>
                <dt>
                  <Layers size={16} />
                  Cotas restantes
                </dt>
                <dd>{p.availableUnits}</dd>
              </div>
              <div>
                <dt>Limite por pessoa</dt>
                <dd>{p.maxUnitsPerUser} cotas</dd>
              </div>
              <div>
                <dt>Início previsto</dt>
                <dd>{date(p.startDate)}</dd>
              </div>
              <div>
                <dt>Encerramento previsto</dt>
                <dd>{date(p.endDate)}</dd>
              </div>
            </dl>
            <div className="estimate-highlight">
              <span>Projeção máxima no período · {p.returnMultiplier.toFixed(1)}x</span>
              <strong>{money(p.projectedTotalReturn)}</strong>
            </div>
            <p className="disclaimer">
              Os créditos programados do projeto são liberados conforme a operação da plataforma e ficam visíveis na carteira. O saldo liberado pode ser acompanhado pelo histórico.
            </p>
            <button
              className="button primary full desktop-purchase"
              disabled={closed}
              onClick={() => setOpen(true)}
            >
              {closed
                ? projectStatus[p.status]
                : `Participar por ${money(p.investmentAmount)}`}
              <ArrowUpRight size={18} />
            </button>
          </section>
        </div>
      </div>
      <div className="sticky-purchase">
        <button
          disabled={closed}
          className="button primary full"
          onClick={() => setOpen(true)}
        >
          {closed
            ? projectStatus[p.status]
            : `Participar por ${money(p.investmentAmount)}`}
          <ArrowUpRight size={18} />
        </button>
      </div>
      {open && (
        <ConfirmPurchaseModal project={p} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
export function UserSolarProjectCard({ holding }: { holding: UserProject }) {
  const { data } = useApp();
  const p = data.projects.find((p) => p.id === holding.projectId);
  if (!p) return null;
  return (
    <article className="surface holding-card">
      <div className="holding-heading">
        <div className="holding-icon">
          <Sun size={26} />
        </div>
        <div>
          <h3>{p.name}</h3>
          <p>
            {p.city} · {p.state}
          </p>
        </div>
        <span
          className={`pill ${holding.status === "active" ? "green" : "gray"}`}
        >
          {holding.status === "active" ? "Ativo" : "Concluído"}
        </span>
      </div>
      <div className="holding-metrics">
        <div>
          <span>Aplicado{data.demo ? " (simulação)" : ""}</span>
          <strong>{money(holding.amountInvested)}</strong>
        </div>
        <div>
          <span>Créditos recebidos</span>
          <strong className="positive">{money(holding.totalReceived)}</strong>
        </div>
        <div>
          <span>Projeção acumulada</span>
          <strong>{money(Math.min(p.projectedTotalReturn * holding.quantity, p.dailyProjectedReturn * holding.quantity * holding.elapsedDays))}</strong>
        </div>
        <div>
          <span>Estimativa total</span>
          <strong>{money(p.projectedTotalReturn * holding.quantity)}</strong>
        </div>
      </div>
      <InvestmentProgress day={holding.elapsedDays} total={p.durationDays} />
      <div className="holding-bottom">
        <span>
          <Clock3 size={15} />
          Próximo crédito estimado{" "}
          <b>
            {money(
              holding.status === "active"
                ? p.dailyProjectedReturn * holding.quantity
                : 0,
            )}
          </b>
        </span>
        <Link href={`/meus-paineis/${holding.id}`}>
          Ver detalhes <ChevronRight size={17} />
        </Link>
      </div>
    </article>
  );
}
