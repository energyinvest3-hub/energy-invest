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
          ? "CashOut ativado. O PIX só será enviado quando você autorizar individualmente o saque na aba Saques."
          : "CashOut automático desativado. Nenhum PIX será enviado pela PushinPay.",
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
          <h2>PIX CashOut da PushinPay</h2>
        </div>
        <Settings size={20} />
      </div>

      <div className="info-box">
        <ShieldCheck size={19} />
        <p>
          Quando ativado, o botão de autorização da aba Saques envia
          o valor líquido diretamente para a chave PIX cadastrada.
          Nada é enviado sem sua autorização individual.
        </p>
      </div>

      <label className="field">
        Envio de pagamentos
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
  cashoutStatus = "",
}: {
  withdrawalId: string;
  alreadyAuthorized?: boolean;
  cashoutStatus?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(cashoutStatus);

  const normalized = status.toLowerCase();

  const locked = [
    "sending",
    "created",
    "paid",
    "review",
  ].includes(normalized);

  async function authorize() {
    setBusy(true);

    try {
      const body = await payoutRequest({
        action: "authorize_withdrawal",
        withdrawalId,
      });

      setStatus(
        String(
          body.cashout?.status ??
            body.withdrawal?.cashout_status ??
            "created",
        ),
      );

      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o PIX.",
      );

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const label =
    normalized === "paid"
      ? "PIX pago"
      : normalized === "created" || normalized === "sending"
        ? "PIX enviado"
        : normalized === "review"
          ? "Revisar na PushinPay"
          : normalized === "failed"
            ? "Tentar envio novamente"
            : alreadyAuthorized
              ? "Enviar PIX"
              : "Autorizar e enviar PIX";

  return (
    <button
      className="button small"
      disabled={busy || locked}
      onClick={authorize}
      title={
        normalized === "review"
          ? "O resultado do envio ficou incerto. Confira a PushinPay antes de qualquer nova tentativa."
          : undefined
      }
    >
      {busy ? "Enviando…" : label}
    </button>
  );
}
