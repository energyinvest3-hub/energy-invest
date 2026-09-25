export type ProjectStatus =
  "available" | "active" | "finished" | "sold_out" | "paused";
export interface SolarProject {
  id: string;
  name: string;
  description: string;
  image: string;
  state: string;
  city: string;
  investmentAmount: number;
  dailyProjectedReturn: number;
  durationDays: number;
  projectedTotalReturn: number;
  returnMultiplier: number;
  international: boolean;
  availableUnits: number;
  maxUnitsPerUser: number;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  isNew?: boolean;
}
export interface UserProject {
  id: string;
  projectId: string;
  quantity: number;
  amountInvested: number;
  totalReceived: number;
  startedAt: string;
  endsAt: string;
  status: "active" | "finished";
  createdAt: string;
  elapsedDays: number;
}
export interface Transaction {
  id: string;
  title: string;
  type: "deposit" | "purchase" | "credit" | "withdrawal" | "bonus";
  amount: number;
  status: "completed" | "pending" | "cancelled";
  createdAt: string;
}
export type GoalKey =
  | "panels_5"
  | "panels_10"
  | "holding_10_days"
  | "holding_30_days";
export interface GoalDefinition {
  key: GoalKey;
  title: string;
  description: string;
  criterionType: "panel_count" | "holding_days";
  targetValue: number;
  bonusAmount: number;
  active: boolean;
  sortOrder: number;
}
export interface GoalReward {
  id: string;
  goalKey: GoalKey;
  bonusAmount: number;
  status: "pending" | "approved" | "credited" | "cancelled";
  claimedAt: string;
  creditedAt: string | null;
}
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
export interface ProjectCredit {
  id: string;
  userProjectId: string;
  amount: number;
  creditNumber: number;
  scheduledAt: string;
  creditedAt: string | null;
  status: "pending" | "completed" | "cancelled";
}

export interface ReferralMember {
  id: string;
  name: string;
  joinedAt: string;
  qualified: boolean;
}

export interface ReferralSummary {
  active: boolean;
  inviteCode: string;
  rewardAmount: number;
  minPurchaseAmount: number;
  invitedCount: number;
  qualifiedCount: number;
  totalBonus: number;
  referrals: ReferralMember[];
}

export interface AppData {
  demo: boolean;
  profile: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
  };
  wallet: {
    balance: number;
    totalDeposited: number;
    totalWithdrawn: number;
    totalEarned: number;
  };
  projects: SolarProject[];
  holdings: UserProject[];
  transactions: Transaction[];
  notifications: AppNotification[];
  credits: ProjectCredit[];
  goalDefinitions: GoalDefinition[];
  rewards: GoalReward[];
  completedTasks: string[];
  referral: ReferralSummary;
}
