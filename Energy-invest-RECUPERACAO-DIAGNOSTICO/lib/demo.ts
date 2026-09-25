import "server-only";
import type { AppData, SolarProject } from "./types";
import { demoProjects } from "./projects";
import { demoGoalDefinitions } from "./goals";
const globalStore = globalThis as unknown as {
  energyDemo?: Map<string, AppData>;
};
const store = (globalStore.energyDemo ??= new Map());
export const isDemo = () => process.env.DEMO_MODE === "true";
function settleDemoCredits(data: AppData) {
  const now = Date.now();
  for (const credit of data.credits) {
    if (
      credit.status !== "pending" ||
      new Date(credit.scheduledAt).getTime() > now
    )
      continue;
    const holding = data.holdings.find(
      (item) => item.id === credit.userProjectId,
    );
    if (!holding || holding.status !== "active") continue;
    credit.status = "completed";
    credit.creditedAt = new Date().toISOString();
    holding.totalReceived += credit.amount;
    data.wallet.balance += credit.amount;
    data.wallet.totalEarned += credit.amount;
    data.transactions.unshift({
      id: `credit-${credit.id}`,
      title: "Crédito simulado de projeto",
      type: "credit",
      amount: credit.amount,
      status: "completed",
      createdAt: credit.creditedAt,
    });
    data.notifications.unshift({
      id: `notification-${credit.id}`,
      title: "Crédito simulado registrado",
      message: "Um crédito previsto foi incluído na carteira demonstrativa.",
      read: false,
      createdAt: credit.creditedAt,
    });
  }
  for (const holding of data.holdings) {
    const hasPending = data.credits.some(
      (credit) =>
        credit.userProjectId === holding.id && credit.status === "pending",
    );
    if (!hasPending && new Date(holding.endsAt).getTime() <= now)
      holding.status = "finished";
  }
}
export function demoData(id: string): AppData {
  let data = store.get(id);
  if (!data) {
    if (store.size > 1000) store.delete(store.keys().next().value!);
    data = {
      demo: true,
      profile: { id, name: "Visitante", email: "", phone: "", role: "USER" },
      wallet: {
        balance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalEarned: 0,
      },
      projects: structuredClone(demoProjects),
      holdings: [],
      credits: [],
      goalDefinitions: structuredClone(demoGoalDefinitions),
      rewards: [],
      completedTasks: [],
      transactions: [],
      referral: {
        active: true,
        inviteCode: "ENERGYDEMO24",
        rewardAmount: 20,
        minPurchaseAmount: 50,
        invitedCount: 0,
        qualifiedCount: 0,
        totalBonus: 0,
        referrals: [],
      },
      notifications: [
        {
          id: "welcome",
          title: "Bem-vindo à sua energia do futuro",
          message:
            "Explore os projetos e acompanhe uma participação simulada. Nenhum dinheiro real é movimentado.",
          read: false,
          createdAt: "2026-09-19T12:00:00Z",
        },
        {
          id: "new",
          title: "Um novo horizonte em Minas Gerais",
          message:
            "Conheça o projeto Horizonte Solar Minas, disponível no catálogo.",
          read: false,
          createdAt: "2026-09-19T10:00:00Z",
        },
      ],
    };
    store.set(id, data);
  }
  // Keep already-open demo sessions compatible when new non-financial fields
  // are introduced during development.
  data.completedTasks ??= [];
  data.credits ??= [];
  data.goalDefinitions ??= structuredClone(demoGoalDefinitions);
  data.rewards ??= [];
  data.referral ??= {
    active: true,
    inviteCode: "ENERGYDEMO24",
    rewardAmount: 20,
    minPurchaseAmount: 50,
    invitedCount: 0,
    qualifiedCount: 0,
    totalBonus: 0,
    referrals: [],
  };
  for (const project of demoProjects) {
    const existing = data.projects.find(
      (item: SolarProject) => item.id === project.id,
    );
    if (!existing) data.projects.push(structuredClone(project));
    else if (existing.id === "solar-inicial") existing.investmentAmount = 50;
  }
  settleDemoCredits(data);
  return data;
}
