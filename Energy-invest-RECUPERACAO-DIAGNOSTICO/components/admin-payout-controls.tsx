"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, ShieldCheck } from "lucide-react";

async function payoutRequest(
  payload: Record<string, unknown>,
) {
  const res = await fetch(
    "/api/admin/payouts",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  const body = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      body.error ||
        "Não foi possível concluir a operação.",
    );
  }

  return body;
}

export function AdminPayoutControls() {
  const [enabled, setEnabled] =
    useState(false);
  const [savedEnabled, setSavedEnabled] =
    useState(false);
  const [busy, setBusy] =
    useState(false);
  const [loading, setLoading] =
    useState(true);
  const [message, setMessage] =
    useState("");

  async function load() {
    setLoading(true);

    try {
      const body =
        await payoutRequest({
          action: "load",
        });

      const value = Boolean(
        body.settings
          ?.automatic_processing_enabled,
      );

      setEnabled(value);
      setSavedEnabled(value);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao carregar controles.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveAutomatic() {
    setBusy(true);
    setMessage("");

    try {
      const body =
        await payoutRequest({
          action: "set_auto",
          enabled,
        });

      const persisted = Boolean(
        body.settings
          ?.automatic_processing_enabled,
      );

      setEnabled(persisted);
      setSavedEnabled(persisted);

      setMessage(
        persisted
          ? "PIX CashOut ATIVADO e salvo. Agora você pode autorizar os pagamentos na aba Saques."
          : "PIX CashOut DESATIVADO e salvo.",
      );
    } catch (error) {
      setEnabled(savedEnabled);

      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao salvar configuração.",
      );
    } finally {
      setBusy(false);
    }
  }

  const changed =
    enabled !== savedEnabled;

  return (
    <section className="surface admin-settings-card">
      <div className="section-title">
        <div>
          <span className="eyebrow">
            CONTROLE DE SAQUES
          </span>
          <h2>
            PIX CashOut da PushinPay
          </h2>
        </div>
        <Settings size={20} />
      </div>

      <div className="info-box">
        <ShieldCheck size={19} />
        <p>
          Quando ativado, você pode
          autorizar individualmente cada
          saque na aba Saques. O PIX só
          é enviado quando você clicar
          em autorizar.
        </p>
      </div>

      <label className="field">
        Envio de pagamentos

        <select
          disabled={busy || loading}
          value={
            loading
              ? "loading"
              : enabled
                ? "on"
                : "off"
          }
          onChange={(event) =>
            setEnabled(
              event.target.value ===
                "on",
            )
          }
        >
          {loading && (
            <option value="loading">
              Carregando configuração…
            </option>
          )}
          <option value="off">
            Desativado
          </option>
          <option value="on">
            Ativado
          </option>
        </select>
      </label>

      <button
        className="button primary"
        disabled={
          busy ||
          loading ||
          !changed
        }
        onClick={saveAutomatic}
      >
        {busy
          ? "Salvando…"
          : changed
            ? "Salvar configuração"
            : "Configuração salva"}
      </button>

      {message && (
        <div
          className="form-success"
          role="status"
          style={{
            marginTop: 14,
          }}
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
  const [busy, setBusy] =
    useState(false);
  const [status, setStatus] =
    useState(cashoutStatus);

  const normalized =
    status.toLowerCase();

  const locked = [
    "sending",
    "created",
    "paid",
    "review",
  ].includes(normalized);

  async function authorize() {
    setBusy(true);

    try {
      const body =
        await payoutRequest({
          action:
            "authorize_withdrawal",
          withdrawalId,
        });

      setStatus(
        String(
          body.cashout?.status ??
            body.withdrawal
              ?.cashout_status ??
            "created",
        ),
      );

      window.alert(
        body.message ??
          "PIX enviado para processamento.",
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
      : normalized ===
            "created" ||
          normalized ===
            "sending"
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
          ? "Confira o painel da PushinPay antes de qualquer nova tentativa."
          : undefined
      }
    >
      {busy
        ? "Enviando…"
        : label}
    </button>
  );
}
