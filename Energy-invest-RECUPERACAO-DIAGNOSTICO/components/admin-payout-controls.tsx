"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, ShieldCheck, Wallet } from "lucide-react";
import { money, date } from "@/lib/format";
import { Modal } from "./ui";

type Row = Record<string, unknown>;

async function payoutRequest(payload: Record<string, unknown>) {
  const res = await fetch("/api/admin/payouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}

export function AdminPayoutControls() {
  const [enabled, setEnabled] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [amount, setAmount] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixKey, setPixKey] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const body = await payoutRequest({ action: "load" });
      setEnabled(Boolean(body.settings?.automatic_processing_enabled));
      setRows(Array.isArray(body.manualPix) ? body.manualPix : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar controles.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveAutomatic() {
    setBusy(true);
    setMessage("");
    try {
      await payoutRequest({ action: "set_auto", enabled });
      setMessage(
        enabled
          ? "Processamento automático ativado. Cada saque ainda precisa da sua autorização individual."
          : "Processamento automático desativado.",
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar configuração.");
    } finally {
      setBusy(false);
    }
  }

  async function createManualPix() {
    const numericAmount = Number(amount);
    if (!recipientName.trim() || !pixKey.trim() || !(numericAmount > 0)) {
      setMessage("Preencha destinatário, valor e chave PIX.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      await payoutRequest({
        action: "create_manual_pix",
        recipientName: recipientName.trim(),
        amount: numericAmount,
        pixKeyType,
        pixKey: pixKey.trim(),
        note: note.trim(),
      });
      setRecipientName("");
      setAmount("");
      setPixKey("");
      setNote("");
      setMessage("PIX manual registrado. Faça o pagamento e depois marque como enviado.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao registrar PIX manual.");
    } finally {
      setBusy(false);
    }
  }

  async function updateManualPix(id: string, status: "sent" | "cancelled") {
    setBusy(true);
    setMessage("");
    try {
      await payoutRequest({ action: "update_manual_pix", id, status });
      setMessage(status === "sent" ? "PIX manual marcado como enviado." : "PIX manual cancelado.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao atualizar PIX manual.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="surface admin-settings-card">
        <div className="section-title">
          <div>
            <span className="eyebrow">CONTROLE DE SAQUES</span>
            <h2>Autorização do PIX automático</h2>
          </div>
          <Settings size={20} />
        </div>

        <div className="info-box">
          <ShieldCheck size={19} />
          <p>
            O automático fica bloqueado por padrão. Mesmo ativado aqui, cada solicitação
            precisa ser autorizada individualmente por você na aba Saques.
          </p>
        </div>

        <div className="form-grid">
          <label className="field">
            Processamento automático
            <select value={enabled ? "on" : "off"} onChange={(e) => setEnabled(e.target.value === "on")}>
              <option value="off">Desativado</option>
              <option value="on">Ativado</option>
            </select>
          </label>
        </div>

        <div className="table-actions">
          <button className="button primary" disabled={busy} onClick={saveAutomatic}>
            Salvar configuração
          </button>
          <button className="button" disabled={busy} onClick={() => { setManualOpen(true); void load(); }}>
            <Wallet size={17} /> PIX manual
          </button>
        </div>

        {message && <div className="form-success" role="status" style={{ marginTop: 14 }}>{message}</div>}
      </section>

      {manualOpen && (
        <Modal title="PIX manual" onClose={() => setManualOpen(false)}>
          <div className="legal-copy">
            <p>
              Este painel é independente das solicitações de saque dos clientes.
              Você escolhe o destinatário, valor e chave PIX.
            </p>
          </div>

          <div className="form-grid">
            <label className="field">
              Destinatário
              <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
            </label>
            <label className="field">
              Valor
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="field">
              Tipo da chave
              <select value={pixKeyType} onChange={(e) => setPixKeyType(e.target.value)}>
                <option value="cpf">CPF</option>
                <option value="email">E-mail</option>
                <option value="phone">Telefone</option>
                <option value="random">Aleatória</option>
                <option value="other">Outra</option>
              </select>
            </label>
            <label className="field">
              Chave PIX
              <input value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
            </label>
          </div>

          <label className="field">
            Observação
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <button className="button primary full" disabled={busy} onClick={createManualPix}>
            Registrar PIX manual
          </button>

          <div className="table-scroll" style={{ marginTop: 20 }}>
            <table>
              <thead>
                <tr><th>Destinatário</th><th>Valor / PIX</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.id)}>
                    <td><strong>{String(row.recipient_name ?? "—")}</strong><small>{String(row.note ?? "")}</small></td>
                    <td>{money(Number(row.amount ?? 0))}<small>{String(row.pix_key_type ?? "").toUpperCase()}: <strong>{String(row.pix_key ?? "—")}</strong></small></td>
                    <td>
                      <span className={`pill ${row.status === "sent" ? "green" : row.status === "pending" ? "orange" : "gray"}`}>
                        {String(row.status ?? "pending")}
                      </span>
                      <small>{row.created_at ? date(String(row.created_at)) : ""}</small>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="button small" onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(String(row.pix_key ?? ""));
                            setMessage("Chave PIX copiada.");
                          } catch {
                            setMessage("Não foi possível copiar a chave PIX.");
                          }
                        }}>Copiar PIX</button>
                        {row.status === "pending" && (
                          <>
                            <button className="button primary small" disabled={busy} onClick={() => updateManualPix(String(row.id), "sent")}>Marcar enviado</button>
                            <button className="button small" disabled={busy} onClick={() => updateManualPix(String(row.id), "cancelled")}>Cancelar</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={4}>Nenhum PIX manual registrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AuthorizeAutomaticWithdrawalButton({
  withdrawalId,
  alreadyAuthorized,
}: {
  withdrawalId: string;
  alreadyAuthorized?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(Boolean(alreadyAuthorized));

  async function authorize() {
    setBusy(true);
    try {
      await payoutRequest({ action: "authorize_withdrawal", withdrawalId });
      setAuthorized(true);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível autorizar o saque.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="button small" disabled={busy || authorized} onClick={authorize}>
      {authorized ? "Autorizado" : "Autorizar automático"}
    </button>
  );
}
