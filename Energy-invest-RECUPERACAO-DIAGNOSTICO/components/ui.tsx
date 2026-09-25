"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Inbox, X, LoaderCircle } from "lucide-react";
export function PageTitle({
  eyebrow,
  title,
  description,
  back,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  back?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {back && (
          <Link className="back-link" href={back}>
            <ArrowLeft size={17} /> Voltar
          </Link>
        )}
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function SectionTitle({
  title,
  href,
  label = "Ver todos",
}: {
  title: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {href && (
        <Link href={href}>
          {label}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Inbox size={30} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link className="button primary" href={href}>
          {label}
        </Link>
      )}
    </div>
  );
}
export function LoadingSkeleton() {
  return (
    <div className="skeleton-wrap" aria-label="Carregando" role="status">
      <div className="skeleton short" />
      <div className="skeleton tall" />
      <div className="project-grid">
        {[1, 2, 3].map((n) => (
          <div className="skeleton tall" key={n} />
        ))}
      </div>
    </div>
  );
}
export function InvestmentProgress({
  day,
  total,
}: {
  day: number;
  total: number;
}) {
  const progress = Math.min(100, Math.max(0, Math.round((day / total) * 100)));
  return (
    <div className="investment-progress">
      <div>
        <span>
          Dia {Math.min(day, total)} de {total}
        </span>
        <strong>{progress}%</strong>
      </div>
      <progress aria-label="Progresso do projeto" value={progress} max={100} />
    </div>
  );
}
export function AmountInput({
  value,
  onChange,
  label = "Valor",
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  max?: number;
}) {
  return (
    <label className="field">
      {label}
      <div className="amount-input">
        <span>R$</span>
        <input
          aria-label={label}
          type="number"
          inputMode="decimal"
          placeholder="0,00"
          step="0.01"
          min="1"
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-handle" />
      <div className="modal-title">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Busy({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      {loading ? (
        <>
          <LoaderCircle className="spin" size={18} /> Aguarde…
        </>
      ) : (
        children
      )}
    </>
  );
}
