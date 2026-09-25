import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";
import { demoData, isDemo } from "./demo";
import type {
  AppData,
  GoalDefinition,
  GoalReward,
  SolarProject,
  UserProject,
} from "./types";
import { getProjectImage } from "./project-images";
export async function getAppData(): Promise<AppData> {
  if (isDemo()) {
    const id = (await cookies()).get("energy_demo")?.value;
    return demoData(id ?? "preview");
  }
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const results = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).single(),
    db.from("wallets").select("*").eq("user_id", user.id).single(),
    db.from("solar_projects").select("*").order("created_at"),
    db.from("user_projects").select("*").eq("user_id", user.id),
    db
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    db
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    db
      .from("project_credits")
      .select("*, user_projects!inner(user_id)")
      .eq("user_projects.user_id", user.id)
      .order("credit_number"),
    db.from("user_tasks").select("task_key").eq("user_id", user.id),
    db
      .from("goal_definitions")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    db
      .from("user_rewards")
      .select("*")
      .eq("user_id", user.id)
      .order("claimed_at", { ascending: false }),
    db.rpc("get_referral_summary"),
  ]);
  const fail = results.find((r) => r.error);
  if (fail?.error)
    throw new Error(
      "Não foi possível carregar sua conta. Verifique a configuração do banco.",
    );
  const [
    profile,
    wallet,
    projects,
    holdings,
    transactions,
    notifications,
    credits,
    tasks,
    goalDefinitions,
    rewards,
    referralRaw,
  ] = results.map((r) => r.data);
  const referral = (referralRaw ?? {}) as Record<string, unknown>;
  const referralMembers = Array.isArray(referral.referrals) ? referral.referrals : [];
  return {
    demo: false,
    profile: {
      id: user.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      role: user.app_metadata.role === "ADMIN" ? "ADMIN" : "USER",
    },
    wallet: {
      balance: Number(wallet.balance),
      totalDeposited: Number(wallet.total_deposited),
      totalWithdrawn: Number(wallet.total_withdrawn),
      totalEarned: Number(wallet.total_earned),
    },
    projects: projects.map((r: Record<string, unknown>): SolarProject => ({
      id: String(r.id),
      name: String(r.name),
      description: String(r.description),
      image: getProjectImage(String(r.name), projects.indexOf(r)),
      state: String(r.state),
      city: String(r.city),
      investmentAmount: Number(r.investment_amount),
      dailyProjectedReturn: Number(r.daily_projected_return),
      durationDays: Number(r.duration_days),
      projectedTotalReturn: Number(r.investment_amount) * Number(r.return_multiplier ?? 1),
      returnMultiplier: Number(r.return_multiplier ?? 1),
      international: ["Europa", "EUA", "China"].includes(String(r.state)),
      availableUnits: Number(r.available_units),
      maxUnitsPerUser: Number(r.max_units_per_user),
      startDate: String(r.start_date),
      endDate: String(r.end_date),
      status: r.status as SolarProject["status"],
    })),
    holdings: holdings.map((r: Record<string, unknown>): UserProject => ({
      id: String(r.id),
      projectId: String(r.project_id),
      quantity: Number(r.quantity),
      amountInvested: Number(r.amount_invested),
      totalReceived: Number(r.total_received),
      startedAt: String(r.started_at),
      endsAt: String(r.ends_at),
      status: r.status as UserProject["status"],
      createdAt: String(r.created_at),
      elapsedDays: Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(String(r.started_at)).getTime()) / 86400000,
        ),
      ),
    })),
    transactions: transactions.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      title: String(r.description ?? r.type),
      type: r.type as AppData["transactions"][number]["type"],
      amount: Number(r.amount),
      status: r.status as AppData["transactions"][number]["status"],
      createdAt: String(r.created_at),
    })),
    credits: credits.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      userProjectId: String(r.user_project_id),
      amount: Number(r.amount),
      creditNumber: Number(r.credit_number),
      scheduledAt: String(r.scheduled_at),
      creditedAt: r.credited_at ? String(r.credited_at) : null,
      status: r.status as AppData["credits"][number]["status"],
    })),
    completedTasks: tasks.map((r: Record<string, unknown>) =>
      String(r.task_key),
    ),
    goalDefinitions: goalDefinitions.map(
      (r: Record<string, unknown>): GoalDefinition => ({
        key: r.key as GoalDefinition["key"],
        title: String(r.title),
        description: String(r.description),
        criterionType: r.criterion_type as GoalDefinition["criterionType"],
        targetValue: Number(r.target_value),
        bonusAmount: Number(r.bonus_amount),
        active: Boolean(r.active),
        sortOrder: Number(r.sort_order),
      }),
    ),
    rewards: rewards.map(
      (r: Record<string, unknown>): GoalReward => ({
        id: String(r.id),
        goalKey: r.goal_key as GoalReward["goalKey"],
        bonusAmount: Number(r.bonus_amount),
        status: r.status as GoalReward["status"],
        claimedAt: String(r.claimed_at),
        creditedAt: r.credited_at ? String(r.credited_at) : null,
      }),
    ),
    notifications: notifications.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      title: String(r.title),
      message: String(r.message),
      read: Boolean(r.read),
      createdAt: String(r.created_at),
    })),
    referral: {
      active: Boolean(referral.active),
      inviteCode: String(referral.inviteCode ?? ""),
      rewardAmount: Number(referral.rewardAmount ?? 0),
      minPurchaseAmount: Number(referral.minPurchaseAmount ?? 0),
      invitedCount: Number(referral.invitedCount ?? 0),
      qualifiedCount: Number(referral.qualifiedCount ?? 0),
      totalBonus: Number(referral.totalBonus ?? 0),
      referrals: referralMembers.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          id: String(row.id),
          name: String(row.name ?? "Convidado"),
          joinedAt: String(row.joinedAt ?? ""),
          qualified: Boolean(row.qualified),
        };
      }),
    },
  };
}
