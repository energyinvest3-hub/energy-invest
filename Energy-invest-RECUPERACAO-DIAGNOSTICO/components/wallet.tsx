"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDownLeft,
  ArrowUpRight,
  PanelsTopLeft,
  Wallet,
  Check,
  Clock3,
  ShieldCheck,
  ChevronRight,
  Gift,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "./shell";
import { money, date } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import {
  PageTitle,
  SectionTitle,
  EmptyState,
  AmountInput,
  Modal,
  Busy,
} from "./ui";
import { WalletCard, Stat } from "./dashboard";
import {
  createDeposit,
  getDepositStatus,
  performAction,
} from "@/services/projects";
import {
  isWithdrawalWindow,
  withdrawalWindowLabel,
} from "@/lib/withdrawal-window";
export function TransactionItem({
  transaction: t,
}: {
  transaction: Transaction;
}) {
  return (
    <div className="transaction">
      <div className={`transaction-icon ${t.amount >= 0 ? "green" : ""}`}>
        {t.type === "bonus" ? (
          <Gift size={20} />
        ) : t.type === "purchase" ? (
          <PanelsTopLeft size={20} />
        ) : t.amount >= 0 ? (
          <ArrowDownLeft size={20} />
        ) : (
          <ArrowUpRight size={20} />
        )}
      </div>
      <div className="transaction-info">
        <strong>{t.title}</strong>
        <span>{date(t.createdAt)}</span>
      </div>
      <div className="transaction-value">
        <strong
          className={t.amount > 0 && t.status === "completed" ? "positive" : ""}
        >
          {t.amount > 0 ? "+ " : t.amount < 0 ? "− " : ""}
          {money(Math.abs(t.amount))}
        </strong>
        <span className={t.status === "pending" ? "pending" : ""}>
          {
            {
              completed: "Concluído",
              pending: "Pendente",
              cancelled: "Cancelado",
            }[t.status]
          }
        </span>
      </div>
    </div>
  );
}
export function WalletPage() {
  const { data } = useApp();
  const [filter, setFilter] = useState("Todos");
  const rows = data.transactions.filter(
    (t) =>
      filter === "Todos" ||
      t.type ===
        (
          {
            Entradas: "deposit",
            Saídas: "withdrawal",
            Créditos: "credit",
            Bônus: "bonus",
            Participações: "purchase",
          } as Record<string, string>
        )[filter],
  );
  return (
    <>
      <PageTitle
        eyebrow="TUDO SOB CONTROLE"
        title="Minha carteira"
        description="Sua movimentação, com clareza e simplicidade."
      />
      <div className="wallet-page-grid">
        <WalletCard />
        <div className="wallet-summary">
          <Stat
            icon={<PanelsTopLeft size={21} />}
            title="Total aplicado"
            value={money(
              data.holdings.reduce((s, h) => s + h.amountInvested, 0),
            )}
          />
          <Stat
            icon={<ArrowDownLeft size={21} />}
            title="Total recebido"
            value={money(data.wallet.totalEarned)}
            green
          />
          <Stat
            icon={<ArrowUpRight size={21} />}
            title="Total sacado"
            value={money(data.wallet.totalWithdrawn)}
          />
        </div>
      </div>
      <SectionTitle title="Histórico de movimentações" />
      <div className="filter-scroll">
        {["Todos", "Entradas", "Saídas", "Créditos", "Bônus", "Participações"].map(
          (t) => (
            <button
              className={`chip ${filter === t ? "active" : ""}`}
              key={t}
              onClick={() => setFilter(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>
      <section className="surface transaction-list">
        {rows.length ? (
          rows.map((t) => <TransactionItem key={t.id} transaction={t} />)
        ) : (
          <EmptyState
            title="Tudo começa com o primeiro passo"
            description="Suas movimentações aparecerão aqui assim que você adicionar saldo ou realizar uma operação."
          />
        )}
      </section>
    </>
  );
}
export function DepositPage() {
  const { toast, refresh } = useApp();
  const [amount, setAmount] = useState("100");
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deposit, setDeposit] = useState<{
    id: string;
    identifier: string;
    amount: number;
    status: "pending" | "completed" | "cancelled";
    pixCode: string;
    qrCodeDataUrl: string;
  } | null>(null);
  const cpfDigits = cpf.replace(/\D/g, "");
  const valid =
    Number(amount) >= 1 && Number(amount) <= 100000 && cpfDigits.length === 11;

  useEffect(() => {
    if (!deposit || deposit.status !== "pending") return;
    let stopped = false;
    const timer = window.setInterval(async () => {
      try {
        const result = await getDepositStatus(deposit.id);
        const next = result.deposit?.status as
          | "pending"
          | "completed"
          | "cancelled"
          | undefined;
        if (!stopped && next && next !== "pending") {
          setDeposit((current) => (current ? { ...current, status: next } : current));
          if (next === "completed") {
            refresh();
            toast("PIX confirmado. Saldo atualizado.");
          }
        }
      } catch {
        // O webhook continua sendo a fonte de verdade; uma falha momentânea de polling é ignorada.
      }
    }, 3000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [deposit, refresh, toast]);

  async function submit() {
    setBusy(true);
    try {
      const result = await createDeposit(Number(amount), cpfDigits);
      setDeposit(result.deposit);
      refresh();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function copyPix() {
    if (!deposit?.pixCode) return;
    try {
      await navigator.clipboard.writeText(deposit.pixCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Não foi possível copiar automaticamente.", true);
    }
  }

  return (
    <div className="narrow">
      <PageTitle
        title="Adicionar saldo"
        description="Gere um PIX e receba o saldo automaticamente após a confirmação."
        back="/carteira"
      />
      {deposit ? (
        <section className="surface success-state pix-payment-state">
          <div className="success-icon">
            {deposit.status === "completed" ? <CheckCircle2 size={32} /> : <Clock3 size={32} />}
          </div>
          <span className={`pill ${deposit.status === "completed" ? "green" : "orange"}`}>
            {deposit.status === "completed"
              ? "PIX CONFIRMADO"
              : deposit.status === "cancelled"
                ? "PIX CANCELADO"
                : "AGUARDANDO PIX"}
          </span>
          <h2>
            {deposit.status === "completed"
              ? "Saldo liberado"
              : deposit.status === "cancelled"
                ? "Essa cobrança não está mais ativa"
                : "Escaneie ou copie o código PIX"}
          </h2>
          <p className="pix-amount">{money(deposit.amount)}</p>
          {deposit.status === "pending" && (
            <>
              <div className="pix-qr">
                <Image
                  src={deposit.qrCodeDataUrl}
                  alt="QR Code PIX da recarga"
                  width={280}
                  height={280}
                  unoptimized
                />
              </div>
              <div className="pix-copy-box">
                <span>PIX copia e cola</span>
                <code>{deposit.pixCode}</code>
              </div>
              <button className="button primary full" onClick={copyPix}>
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? "Código copiado" : "Copiar código PIX"}
              </button>
              <div className="info-box">
                <ShieldCheck size={20} />
                <p>
                  Não é preciso atualizar a página. Assim que a SyncPay confirmar o pagamento,
                  seu saldo será atualizado automaticamente.
                </p>
              </div>
            </>
          )}
          {deposit.status === "completed" && (
            <Link className="button primary full" href="/carteira">
              Ver saldo atualizado <ChevronRight size={18} />
            </Link>
          )}
          {deposit.status === "cancelled" && (
            <button className="button primary full" onClick={() => setDeposit(null)}>
              Gerar outro PIX
            </button>
          )}
          <small>Referência: {deposit.identifier}</small>
        </section>
      ) : (
        <section className="surface">
          <div className="form-icon">
            <Wallet size={27} />
          </div>
          <h2>Quanto você quer adicionar?</h2>
          <p>O QR Code aparece aqui mesmo e o saldo entra após a confirmação do PIX.</p>
          <div className="quick-amounts">
            {[50, 100, 200, 500, 1000].map((n) => (
              <button
                key={n}
                onClick={() => setAmount(String(n))}
                className={Number(amount) === n ? "active" : ""}
              >
                {money(n)}
              </button>
            ))}
          </div>
          <AmountInput label="Outro valor" value={amount} onChange={setAmount} />
          <label className="field">
            CPF do pagador
            <input
              inputMode="numeric"
              autoComplete="off"
              value={cpf}
              onChange={(e) => setCpf(e.target.value.replace(/[^\d.-]/g, "").slice(0, 14))}
              placeholder="000.000.000-00"
            />
            <span className="field-help">Usado pela SyncPay para identificar a cobrança PIX.</span>
          </label>
          <div className="info-box">
            <ShieldCheck size={20} />
            <p>
              A cobrança é gerada pela SyncPay. O código PIX e o QR Code ficam disponíveis nesta tela.
            </p>
          </div>
          <button
            className="button primary full"
            disabled={!valid || busy}
            onClick={submit}
          >
            <Busy loading={busy}>
              Gerar PIX <ArrowUpRight size={18} />
            </Busy>
          </button>
        </section>
      )}
    </div>
  );
}

export function WithdrawalPage() {
  const { data, toast, refresh } = useApp();
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setType] = useState("cpf");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const windowOpen = isWithdrawalWindow();
  const keyValid =
    pixKeyType === "email"
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey)
      : pixKeyType === "cpf"
        ? /^\d{11}$/.test(pixKey.replace(/\D/g, ""))
        : pixKeyType === "phone"
          ? /^\+55\d{10,11}$/.test(pixKey)
          : /^[0-9a-f-]{36}$/i.test(pixKey);
  const valid =
    Number(amount) >= 1 && Number(amount) <= data.wallet.balance && keyValid;
  async function submit() {
    setBusy(true);
    try {
      await performAction({
        action: "withdrawal",
        amount: Number(amount),
        pixKey,
        pixKeyType,
      });
      setDone(true);
      setConfirm(false);
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
        title="Solicitar saque"
        description="Transfira para uma chave PIX de sua titularidade."
        back="/carteira"
      />
      {done ? (
        <section className="surface success-state">
          <Check size={36} />
          <h2>Solicitação recebida</h2>
          <p>Você poderá acompanhar o status pela carteira.</p>
          <Link href="/carteira" className="button primary">
            Voltar à carteira
          </Link>
        </section>
      ) : (
        <section className="surface">
          <div className="available-balance">
            <span>Saldo disponível</span>
            <strong>{money(data.wallet.balance)}</strong>
          </div>
          <AmountInput
            label="Valor do saque"
            value={amount}
            onChange={setAmount}
            max={data.wallet.balance}
          />
          {Number(amount) > data.wallet.balance && (
            <p className="field-error">Saldo insuficiente para este saque.</p>
          )}
          <label className="field">
            Tipo de chave PIX
            <select
              value={pixKeyType}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="cpf">CPF</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="random">Chave aleatória</option>
            </select>
          </label>
          <label className="field">
            Chave PIX
            <input
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder={
                pixKeyType === "phone"
                  ? "+5511999999999"
                  : "Informe sua chave PIX"
              }
            />
          </label>
          {pixKey && !keyValid && (
            <p className="field-error">Confira o formato da chave PIX.</p>
          )}
          <div className="info-box">
            <ShieldCheck size={19} />
            <p>
              Solicitações ficam disponíveis {withdrawalWindowLabel}, no horário de Brasília. O valor solicitado é reservado da carteira e fica pendente até o processamento do PIX.
            </p>
          </div>
          {!windowOpen && (
            <p className="field-error" role="status">
              Janela de saque fechada. Os saques ficam disponíveis diariamente das 09:00 às 18:00, no horário de Brasília.
            </p>
          )}
          <button
            className="button primary full"
            disabled={!valid || !windowOpen}
            onClick={() => setConfirm(true)}
          >
            Solicitar saque
            <ArrowUpRight size={18} />
          </button>
        </section>
      )}
      {confirm && (
        <Modal title="Confirmar solicitação" onClose={() => setConfirm(false)}>
          <dl className="detail-list">
            <div>
              <dt>Valor</dt>
              <dd>{money(Number(amount))}</dd>
            </div>
            <div>
              <dt>Chave PIX</dt>
              <dd>{pixKey}</dd>
            </div>
          </dl>
          <p>Revise sua chave antes de confirmar. O valor será reservado do saldo e a solicitação ficará pendente até o processamento.</p>
          <button
            className="button primary full"
            disabled={busy}
            onClick={submit}
          >
            <Busy loading={busy}>Confirmar solicitação</Busy>
          </button>
        </Modal>
      )}
    </div>
  );
}
