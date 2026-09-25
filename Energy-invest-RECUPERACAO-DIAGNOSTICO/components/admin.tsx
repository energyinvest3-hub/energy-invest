"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  Check,
  CircleDollarSign,
  Gift,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  UserCheck,
  Users,
  Wallet,
  PanelsTopLeft,
} from "lucide-react";
import { projectSchema } from "@/lib/validation";
import { money, date } from "@/lib/format";
import { Busy, EmptyState, Modal, PageTitle } from "./ui";

type ProjectInput = z.infer<typeof projectSchema>;
type Row = Record<string, unknown>;
type AdminData = Record<string, Row[]>;

type Tab =
  | "Usuários"
  | "Carteiras"
  | "Projetos"
  | "Participações"
  | "Depósitos"
  | "Saques"
  | "Créditos"
  | "Indicações"
  | "Transações"
  | "Auditoria"
  | "Configurações";

const numericSum = (rows: Row[], field: string) =>
  rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);

const tabs: Tab[] = [
  "Usuários",
  "Carteiras",
  "Projetos",
  "Participações",
  "Depósitos",
  "Saques",
  "Créditos",
  "Indicações",
  "Transações",
  "Auditoria",
  "Configurações",
];

const keyByTab: Partial<Record<Tab, string>> = {
  Usuários: "profiles",
  Carteiras: "wallets",
  Projetos: "solar_projects",
  Participações: "user_projects",
  Depósitos: "deposits",
  Saques: "withdrawals",
  Créditos: "project_credits",
  Indicações: "referral_rewards",
  Transações: "transactions",
  Auditoria: "admin_audit_logs",
};

function labelFor(row: Row, tab: Tab) {
  if (tab === "Usuários") return String(row.name || row.email || row.id);
  if (tab === "Carteiras")
    return String(row.name || row.email || row.user_id);
  if (tab === "Projetos") return String(row.name || row.id);
  if (tab === "Participações")
    return String(row.project_name || row.id);

  if (tab === "Depósitos" || tab === "Saques")
    return String(row.user_name || row.user_email || row.user_id);

  if (tab === "Créditos")
    return String(row.project_name || `Crédito #${row.credit_number}`);

  if (tab === "Indicações")
    return `${String(row.referrer_name || "Indicador")} → ${String(
      row.referred_name || "Convidado",
    )}`;

  if (tab === "Transações")
    return String(row.description || row.type || row.id);

  if (tab === "Auditoria")
    return String(row.action || row.id).replaceAll("_", " ");

  return String(row.id || "Registro");
}

function sublabelFor(row: Row, tab: Tab) {
  if (tab === "Usuários") return String(row.email || "");

  if (tab === "Carteiras")
    return String(row.email || row.user_id || "");

  if (tab === "Projetos")
    return `${String(row.city || "")} · ${String(row.state || "")}`;

  if (tab === "Participações")
    return String(row.user_name || row.user_email || row.user_id || "");

  if (tab === "Depósitos" || tab === "Saques")
    return String(row.user_email || row.user_id || "");

  if (tab === "Créditos")
    return String(row.user_name || row.user_id || "");

  if (tab === "Indicações")
    return String(row.referrer_email || "");

  if (tab === "Transações")
    return String(row.user_name || row.user_email || row.user_id || "");

  if (tab === "Auditoria")
    return String(row.admin_email || row.admin_user_id || "");

  return "";
}

function amountFor(row: Row, tab: Tab) {
  if (tab === "Usuários" || tab === "Carteiras")
    return Number(row.balance ?? 0);

  if (tab === "Projetos")
    return Number(row.investment_amount ?? 0);

  if (tab === "Participações")
    return Number(row.amount_invested ?? 0);

  if (
    tab === "Depósitos" ||
    tab === "Saques" ||
    tab === "Créditos" ||
    tab === "Indicações" ||
    tab === "Transações"
  )
    return Number(row.amount ?? 0);

  return null;
}

export function AdminPage({ records }: { records: AdminData }) {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("Usuários");
  const [query, setQuery] = useState("");
  const [editingProject, setEditingProject] =
    useState<Partial<ProjectInput> | null>(null);

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const profiles = records.profiles ?? [];
  const wallets = records.wallets ?? [];
  const projects = records.solar_projects ?? [];
  const holdings = records.user_projects ?? [];
  const deposits = records.deposits ?? [];
  const withdrawals = records.withdrawals ?? [];
  const credits = records.project_credits ?? [];
  const referrals = records.referral_rewards ?? [];
  const transactions = records.transactions ?? [];

  const rows =
    tab === "Configurações"
      ? []
      : records[keyByTab[tab] ?? ""] ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter((row) =>
      JSON.stringify(row).toLowerCase().includes(q),
    );
  }, [rows, query]);

  const completedDeposits = deposits.filter(
    (r) => r.status === "completed",
  );

  const pendingWithdrawals = withdrawals.filter(
    (r) => r.status === "pending",
  );

  const activeHoldings = holdings.filter(
    (r) => r.status === "active",
  );

  const futureCredits = credits.filter(
    (r) => r.status === "pending",
  );

  async function adminAction(
    payload: Record<string, unknown>,
    success: string,
  ) {
    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json();

      if (!res.ok)
        throw new Error(
          body.error || "Operação não concluída.",
        );

      setMessage(success);
      router.refresh();

      return body.data;
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Erro na operação.",
      );

      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveProject(value: ProjectInput) {
    const res = await fetch("/api/admin/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
    });

    const body = await res.json();

    if (!res.ok)
      throw new Error(
        body.error || "Não foi possível salvar o projeto.",
      );

    setEditingProject(null);
    setMessage("Projeto salvo com sucesso.");
    router.refresh();
  }

  async function editUser(row: Row) {
    const name = window.prompt(
      "Nome do usuário",
      String(row.name || ""),
    );

    if (name === null) return;

    const phone = window.prompt(
      "Telefone",
      String(row.phone || ""),
    );

    if (phone === null) return;

    await adminAction(
      {
        action: "update_profile",
        userId: String(row.id),
        name,
        phone,
      },
      "Usuário atualizado.",
    );
  }

  async function adjustWallet(row: Row) {
    const raw = window.prompt(
      "Ajuste de saldo. Use valor positivo para adicionar ou negativo para retirar.",
      "0",
    );

    if (raw === null) return;

    const delta = Number(raw.replace(",", "."));

    if (!Number.isFinite(delta) || delta === 0) {
      setMessage(
        "Informe um valor diferente de zero.",
      );
      return;
    }

    const reason = window.prompt(
      "Motivo do ajuste (obrigatório)",
      "Ajuste administrativo",
    );

    if (!reason) return;

    await adminAction(
      {
        action: "adjust_wallet",
        userId: String(row.user_id ?? row.id),
        delta,
        reason,
      },
      "Carteira ajustada e auditoria registrada.",
    );
  }

  async function toggleUser(row: Row) {
    const disabled = Boolean(
      row.banned_until &&
        new Date(
          String(row.banned_until),
        ).getTime() > Date.now(),
    );

    await adminAction(
      {
        action: "toggle_user",
        userId: String(row.id),
        enabled: disabled,
      },
      disabled
        ? "Usuário reativado."
        : "Usuário bloqueado.",
    );
  }

  async function updateWithdrawal(
    id: string,
    action: "complete" | "cancel",
  ) {
    setBusy(true);
    setMessage("");

    try {
      const res = await fetch(
        "/api/admin/withdrawals",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id,
            action,
          }),
        },
      );

      const body = await res.json();

      if (!res.ok)
        throw new Error(
          body.error ||
            "Não foi possível atualizar o saque.",
        );

      setMessage(
        action === "complete"
          ? "Saque concluído."
          : "Saque cancelado e saldo devolvido.",
      );

      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Erro no saque.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="PAINEL ADMINISTRATIVO"
        title="Controle da plataforma"
        description="Usuários, projetos, carteiras, pagamentos, créditos, indicações e auditoria em um só lugar."
      >
        <button
          className="button primary"
          onClick={() =>
            setEditingProject({})
          }
        >
          <Plus size={18} /> Novo projeto
        </button>
      </PageTitle>

      <section className="admin-security-strip">
        <ShieldCheck size={20} />

        <div>
          <strong>
            Administrador autenticado
          </strong>

          <span>
            Alterações sensíveis são executadas no
            servidor e registradas na auditoria.
          </span>
        </div>
      </section>

      <div className="admin-kpi-grid">
        <AdminKpi
          icon={<Users size={20} />}
          label="Usuários"
          value={String(profiles.length)}
          detail={`${activeHoldings.length} participações ativas`}
        />

        <AdminKpi
          icon={<ArrowDownLeft size={20} />}
          label="Depósitos confirmados"
          value={money(
            numericSum(
              completedDeposits,
              "amount",
            ),
          )}
          detail={`${completedDeposits.length} pagamentos`}
        />

        <AdminKpi
          icon={<PanelsTopLeft size={20} />}
          label="Total aplicado"
          value={money(
            numericSum(
              holdings,
              "amount_invested",
            ),
          )}
          detail={`${holdings.length} participações`}
        />

        <AdminKpi
          icon={<Wallet size={20} />}
          label="Saldo nas carteiras"
          value={money(
            numericSum(wallets, "balance"),
          )}
          detail={`${wallets.length} carteiras`}
        />

        <AdminKpi
          icon={<ArrowUpRight size={20} />}
          label="Saques pendentes"
          value={money(
            numericSum(
              pendingWithdrawals,
              "amount",
            ),
          )}
          detail={`${pendingWithdrawals.length} solicitações`}
        />

        <AdminKpi
          icon={<CircleDollarSign size={20} />}
          label="Créditos futuros"
          value={money(
            numericSum(
              futureCredits,
              "amount",
            ),
          )}
          detail={`${futureCredits.length} créditos programados`}
        />

        <AdminKpi
          icon={<Gift size={20} />}
          label="Indicações"
          value={String(referrals.length)}
          detail={money(
            numericSum(referrals, "amount"),
          )}
        />

        <AdminKpi
          icon={<Activity size={20} />}
          label="Transações"
          value={String(transactions.length)}
          detail="histórico financeiro"
        />
      </div>

      <section className="surface admin-quick-actions">
        <div className="section-title">
          <div>
            <span className="eyebrow">
              OPERAÇÃO
            </span>

            <h2>Ações rápidas</h2>
          </div>
        </div>

        <div className="table-actions admin-action-bar">
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              adminAction(
                {
                  action:
                    "reconcile_syncpay",
                },
                "Conciliação da SyncPay iniciada.",
              )
            }
          >
            <RefreshCw size={17} />{" "}
            Reconciliar SyncPay
          </button>

          <button
            className="button"
            disabled={busy}
            onClick={() =>
              adminAction(
                {
                  action:
                    "process_credits",
                },
                "Créditos vencidos processados.",
              )
            }
          >
            <CircleDollarSign
              size={17}
            />{" "}
            Processar créditos
          </button>
        </div>
      </section>

      <div className="filter-scroll admin-module-tabs">
        {tabs.map((name) => (
          <button
            key={name}
            className={`chip ${
              tab === name
                ? "active"
                : ""
            }`}
            onClick={() => {
              setTab(name);
              setQuery("");
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {message && (
        <div
          className="form-success"
          role="status"
        >
          {message}
        </div>
      )}

      {tab === "Configurações" ? (
        <SettingsPanel
          row={
            (
              records.referral_program_settings ??
              []
            )[0]
          }
          disabled={busy}
          onSave={(payload) =>
            adminAction(
              payload,
              "Configurações atualizadas.",
            )
          }
        />
      ) : (
        <section className="surface">
          <div className="admin-table-header">
            <div>
              <span className="eyebrow">
                {tab.toUpperCase()}
              </span>

              <h2>{tab}</h2>
            </div>

            <label className="search-input admin-search">
              <Search size={18} />

              <input
                value={query}
                onChange={(e) =>
                  setQuery(e.target.value)
                }
                placeholder={`Buscar em ${tab.toLowerCase()}`}
              />
            </label>
          </div>

          {!filtered.length ? (
            <EmptyState
              title="Nenhum registro"
              description="Não há registros para os filtros atuais."
            />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Registro</th>
                    <th>Valor / detalhe</th>
                    <th>Status / data</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(
                    (row, index) => {
                      const amount =
                        amountFor(
                          row,
                          tab,
                        );

                      const disabledUser =
                        Boolean(
                          row.banned_until &&
                            new Date(
                              String(
                                row.banned_until,
                              ),
                            ).getTime() >
                              Date.now(),
                        );

                      return (
                        <tr
                          key={String(
                            row.id ??
                              `${tab}-${index}`,
                          )}
                        >
                          <td>
                            <strong>
                              {labelFor(
                                row,
                                tab,
                              )}
                            </strong>

                            <small>
                              {sublabelFor(
                                row,
                                tab,
                              )}
                            </small>
                          </td>

                          <td>
                            {amount !== null
                              ? money(amount)
                              : "—"}

                            {tab ===
                              "Saques" && (
                              <>
                                <small>
                                  PIX (
                                  {String(
                                    row.pix_key_type ||
                                      "chave",
                                  ).toUpperCase()}
                                  ):{" "}
                                  <strong>
                                    {String(
                                      row.pix_key ||
                                        "—",
                                    )}
                                  </strong>
                                </small>

                                {row.fee_amount !=
                                  null && (
                                  <small>
                                    Taxa:{" "}
                                    {money(
                                      Number(
                                        row.fee_amount,
                                      ),
                                    )}{" "}
                                    · Líquido:{" "}
                                    {money(
                                      Number(
                                        row.net_amount ??
                                          row.amount,
                                      ),
                                    )}
                                  </small>
                                )}
                              </>
                            )}

                            {tab ===
                              "Créditos" && (
                              <small>
                                Crédito #
                                {String(
                                  row.credit_number ||
                                    "",
                                )}
                              </small>
                            )}

                            {tab ===
                              "Projetos" && (
                              <small>
                                {String(
                                  row.duration_days ||
                                    "",
                                )}{" "}
                                dias ·{" "}
                                {String(
                                  row.return_multiplier ||
                                    "1",
                                )}
                                x
                              </small>
                            )}
                          </td>

                          <td>
                            <StatusCell
                              row={row}
                              tab={tab}
                            />
                          </td>

                          <td>
                            <div className="table-actions">
                              {tab ===
                                "Usuários" && (
                                <>
                                  <button
                                    title="Editar usuário"
                                    onClick={() =>
                                      editUser(
                                        row,
                                      )
                                    }
                                  >
                                    <Pencil
                                      size={
                                        16
                                      }
                                    />
                                  </button>

                                  <button
                                    title="Ajustar carteira"
                                    onClick={() =>
                                      adjustWallet(
                                        row,
                                      )
                                    }
                                  >
                                    <Wallet
                                      size={
                                        16
                                      }
                                    />
                                  </button>

                                  <button
                                    title={
                                      disabledUser
                                        ? "Reativar"
                                        : "Bloquear"
                                    }
                                    onClick={() =>
                                      toggleUser(
                                        row,
                                      )
                                    }
                                  >
                                    {disabledUser ? (
                                      <UserCheck
                                        size={
                                          16
                                        }
                                      />
                                    ) : (
                                      <Ban
                                        size={
                                          16
                                        }
                                      />
                                    )}
                                  </button>
                                </>
                              )}

                              {tab ===
                                "Carteiras" && (
                                <button
                                  className="button small"
                                  onClick={() =>
                                    adjustWallet(
                                      row,
                                    )
                                  }
                                >
                                  <Wallet
                                    size={
                                      15
                                    }
                                  />{" "}
                                  Ajustar
                                </button>
                              )}

                              {tab ===
                                "Projetos" && (
                                <>
                                  <button
                                    title="Editar"
                                    onClick={() =>
                                      setEditingProject(
                                        row as Partial<ProjectInput>,
                                      )
                                    }
                                  >
                                    <Pencil
                                      size={
                                        16
                                      }
                                    />
                                  </button>

                                  <button
                                    title="Excluir"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          "Excluir este projeto? Projetos com participações não podem ser apagados.",
                                        )
                                      )
                                        adminAction(
                                          {
                                            action:
                                              "delete_project",
                                            projectId:
                                              String(
                                                row.id,
                                              ),
                                          },
                                          "Projeto excluído.",
                                        );
                                    }}
                                  >
                                    <Trash2
                                      size={
                                        16
                                      }
                                    />
                                  </button>
                                </>
                              )}

                              {tab ===
                                "Saques" &&
                                row.status ===
                                  "pending" && (
                                  <>
                                    <button
                                      className="button small primary"
                                      onClick={() =>
                                        updateWithdrawal(
                                          String(
                                            row.id,
                                          ),
                                          "complete",
                                        )
                                      }
                                    >
                                      <Check
                                        size={
                                          15
                                        }
                                      />{" "}
                                      Concluir
                                    </button>

                                    <button
                                      className="button small"
                                      onClick={() =>
                                        updateWithdrawal(
                                          String(
                                            row.id,
                                          ),
                                          "cancel",
                                        )
                                      }
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                )}

                              {!(
                                [
                                  "Usuários",
                                  "Carteiras",
                                  "Projetos",
                                  "Saques",
                                ] as Tab[]
                              ).includes(
                                tab,
                              ) && (
                                <span className="pill gray">
                                  Consulta
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {editingProject && (
        <ProjectForm
          initial={editingProject}
          onClose={() =>
            setEditingProject(null)
          }
          onSave={saveProject}
        />
      )}
    </>
  );
}

function AdminKpi({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="admin-kpi">
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function StatusCell({
  row,
  tab,
}: {
  row: Row;
  tab: Tab;
}) {
  if (tab === "Usuários") {
    const disabled = Boolean(
      row.banned_until &&
        new Date(
          String(row.banned_until),
        ).getTime() > Date.now(),
    );

    return (
      <>
        <span
          className={`pill ${
            disabled ? "gray" : "green"
          }`}
        >
          {disabled
            ? "Bloqueado"
            : String(row.app_role) ===
                "ADMIN"
              ? "Admin"
              : "Ativo"}
        </span>

        <small>
          {row.created_at
            ? date(
                String(row.created_at),
              )
            : ""}
        </small>
      </>
    );
  }

  const status = String(
    row.status ?? "",
  );

  const at =
    row.created_at ??
    row.scheduled_at ??
    row.claimed_at ??
    row.updated_at;

  return (
    <>
      {status ? (
        <span
          className={`pill ${
            status === "completed" ||
            status === "credited" ||
            status === "active" ||
            status === "available"
              ? "green"
              : status === "pending"
                ? "orange"
                : "gray"
          }`}
        >
          {status}
        </span>
      ) : (
        "—"
      )}

      <small>
        {at ? date(String(at)) : ""}
      </small>
    </>
  );
}

function SettingsPanel({
  row,
  disabled,
  onSave,
}: {
  row?: Row;
  disabled: boolean;
  onSave: (
    payload: Record<string, unknown>,
  ) => Promise<unknown>;
}) {
  const [active, setActive] = useState(
    Boolean(row?.active ?? true),
  );

  const [reward, setReward] = useState(
    String(row?.reward_amount ?? 20),
  );

  const [minimum, setMinimum] =
    useState(
      String(
        row?.min_purchase_amount ?? 50,
      ),
    );

  return (
    <section className="surface admin-settings-card">
      <div className="section-title">
        <div>
          <span className="eyebrow">
            CONFIGURAÇÕES
          </span>

          <h2>
            Programa de indicação
          </h2>
        </div>

        <Settings size={20} />
      </div>

      <div className="form-grid">
        <label className="field">
          Status

          <select
            value={
              active ? "on" : "off"
            }
            onChange={(e) =>
              setActive(
                e.target.value === "on",
              )
            }
          >
            <option value="on">
              Ativo
            </option>

            <option value="off">
              Desativado
            </option>
          </select>
        </label>

        <label className="field">
          Bônus por indicação

          <input
            type="number"
            step="0.01"
            value={reward}
            onChange={(e) =>
              setReward(
                e.target.value,
              )
            }
          />
        </label>

        <label className="field">
          Compra mínima elegível

          <input
            type="number"
            step="0.01"
            value={minimum}
            onChange={(e) =>
              setMinimum(
                e.target.value,
              )
            }
          />
        </label>
      </div>

      <button
        className="button primary"
        disabled={disabled}
        onClick={() =>
          onSave({
            action:
              "referral_settings",
            active,
            rewardAmount:
              Number(reward),
            minPurchaseAmount:
              Number(minimum),
          })
        }
      >
        Salvar configurações
      </button>
    </section>
  );
}

function ProjectForm({
  initial,
  onClose,
  onSave,
}: {
  initial: Partial<ProjectInput>;
  onClose: () => void;
  onSave: (
    value: ProjectInput,
  ) => Promise<void>;
}) {
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    control,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<ProjectInput>({
    resolver:
      zodResolver(projectSchema),

    defaultValues: {
      name: "",
      description: "",
      image_url: "/solar-1.jpg",
      city: "",
      state: "SP",
      investment_amount: 50,
      daily_projected_return: 20,
      return_multiplier: 2,
      duration_days: 10,
      available_units: 100,
      max_units_per_user: 5,
      status: "available",
      ...initial,

      start_date:
        initial.start_date?.slice(
          0,
          10,
        ) ??
        new Date()
          .toISOString()
          .slice(0, 10),

      end_date:
        initial.end_date?.slice(
          0,
          10,
        ) ??
        new Date(
          Date.now() +
            10 * 86400000,
        )
          .toISOString()
          .slice(0, 10),
    },
  });

  const [
    amount,
    multiplier,
    days,
  ] = useWatch({
    control,
    name: [
      "investment_amount",
      "return_multiplier",
      "duration_days",
    ],
  });

  const daily = days
    ? (Number(amount || 0) *
        Number(multiplier || 1)) /
      Number(days)
    : 0;

  const fields: [
    keyof ProjectInput,
    string,
    string,
  ][] = [
    ["name", "Nome", "text"],
    [
      "image_url",
      "Imagem",
      "text",
    ],
    ["city", "Cidade", "text"],
    [
      "investment_amount",
      "Valor por cota",
      "number",
    ],
    [
      "return_multiplier",
      "Multiplicador projetado",
      "number",
    ],
    [
      "duration_days",
      "Duração em dias",
      "number",
    ],
    [
      "available_units",
      "Cotas disponíveis",
      "number",
    ],
    [
      "max_units_per_user",
      "Limite por usuário",
      "number",
    ],
    [
      "start_date",
      "Data de início",
      "date",
    ],
    [
      "end_date",
      "Data de encerramento",
      "date",
    ],
  ];

  return (
    <Modal
      title={
        initial.id
          ? "Editar projeto"
          : "Criar projeto"
      }
      onClose={onClose}
    >
      <form
        onSubmit={handleSubmit(
          async (value) => {
            try {
              await onSave({
                ...value,
                daily_projected_return:
                  Math.round(
                    daily * 100,
                  ) / 100,
              });
            } catch (e) {
              setError(
                (e as Error).message,
              );
            }
          },
        )}
      >
        <div className="form-grid">
          {fields.map(
            ([key, label, type]) => (
              <label
                className="field"
                key={key}
              >
                {label}

                <input
                  type={type}
                  step={
                    type === "number"
                      ? "0.01"
                      : undefined
                  }
                  {...register(key, {
                    valueAsNumber:
                      type ===
                      "number",
                  })}
                />

                {errors[key] && (
                  <span className="field-error">
                    {
                      errors[key]
                        ?.message
                    }
                  </span>
                )}
              </label>
            ),
          )}

          <label className="field">
            Estado

            <select
              {...register("state")}
            >
              {[
                "SP",
                "RJ",
                "MG",
                "BA",
                "CE",
                "PE",
                "GO",
                "PR",
                "RS",
                "Europa",
                "EUA",
                "China",
              ].map((s) => (
                <option key={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Status

            <select
              {...register("status")}
            >
              <option value="available">
                Disponível
              </option>

              <option value="active">
                Ativo
              </option>

              <option value="paused">
                Pausado
              </option>

              <option value="finished">
                Finalizado
              </option>

              <option value="sold_out">
                Esgotado
              </option>
            </select>
          </label>
        </div>

        <label className="field">
          Descrição

          <textarea
            rows={4}
            {...register(
              "description",
            )}
          />

          {errors.description && (
            <span className="field-error">
              {
                errors.description
                  .message
              }
            </span>
          )}
        </label>

        <input
          type="hidden"
          {...register(
            "daily_projected_return",
            {
              valueAsNumber: true,
            },
          )}
          value={
            Math.round(
              daily * 100,
            ) / 100
          }
          readOnly
        />

        <div className="estimate-highlight">
          <span>
            Crédito projetado / dia
          </span>

          <strong>
            {money(daily)}
          </strong>
        </div>

        <div className="estimate-highlight">
          <span>
            Projeção total
          </span>

          <strong>
            {money(
              Number(amount || 0) *
                Number(
                  multiplier || 1,
                ),
            )}
          </strong>
        </div>

        {error && (
          <p
            role="alert"
            className="field-error"
          >
            {error}
          </p>
        )}

        <button
          className="button primary full"
          disabled={isSubmitting}
        >
          <Busy
            loading={isSubmitting}
          >
            Salvar projeto
          </Busy>
        </button>
      </form>
    </Modal>
  );
}
