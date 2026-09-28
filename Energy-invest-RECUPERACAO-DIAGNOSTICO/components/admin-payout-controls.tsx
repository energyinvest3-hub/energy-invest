"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, ShieldCheck } from "lucide-react";

async function payoutRequest(payload: Record<string, unknown>) {
  const res = await fetch("/api/admin/payouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.error || "Não foi possível concluir a operação.",
    );
  }

  return body;
}

export function AdminPayoutControls() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const body = await payoutRequest({ action: "load" });
      setEnabled(
        Boolean(body.settings?.automatic_processing_enabled),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao carregar controles.",
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveAutomatic() {
    setBusy(true);
    setMessage("");

    try {
      await payoutRequest({
        action: "set_auto",
        enabled,
      });

      setMessage(
        enabled
          ? "Processamento automático ativado. Cada saque ainda precisa da sua autorização individual."
          : "Processamento automático desativado.",
      );

      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao salvar configuração.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface admin-settings-card">
      <div className="section-title">
        <div>
          <span className="eyebrow">
            CONTROLE DE SAQUES
          </span>
          <h2>Autorização do PIX automático</h2>
        </div>
        <Settings size={20} />
      </div>

      <div className="info-box">
        <ShieldCheck size={19} />
        <p>
          O processamento automático fica bloqueado por padrão.
          Mesmo ativado, cada solicitação precisa da sua autorização
          individual na aba Saques.
        </p>
      </div>

      <label className="field">
        Processamento automático
        <select
          value={enabled ? "on" : "off"}
          onChange={(event) =>
            setEnabled(event.target.value === "on")
          }
        >
          <option value="off">Desativado</option>
          <option value="on">Ativado</option>
        </select>
      </label>

      <button
        className="button primary"
        disabled={busy}
        onClick={saveAutomatic}
      >
        Salvar configuração
      </button>

      {message && (
        <div
          className="form-success"
          role="status"
          style={{ marginTop: 14 }}
        >
          {message}
        </div>
      )}
    </section>
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
  const [authorized, setAuthorized] =
    useState(Boolean(alreadyAuthorized));

  async function authorize() {
    setBusy(true);

    try {
      await payoutRequest({
        action: "authorize_withdrawal",
        withdrawalId,
      });

      setAuthorized(true);
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Não foi possível autorizar o saque.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="button small"
      disabled={busy || authorized}
      onClick={authorize}
    >
      {authorized ? "Autorizado" : "Autorizar automático"}
    </button>
  );
}
