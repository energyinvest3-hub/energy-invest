import type {
  GoalDefinition,
  GoalKey,
  UserProject,
} from "./types";

export const demoGoalDefinitions: GoalDefinition[] = [
  {
    key: "panels_5",
    title: "Tenha 5 painéis",
    description: "Alcance um total de 5 cotas registradas em seus projetos.",
    criterionType: "panel_count",
    targetValue: 5,
    bonusAmount: 5,
    active: true,
    sortOrder: 10,
  },
  {
    key: "panels_10",
    title: "Tenha 10 painéis",
    description: "Alcance um total de 10 cotas registradas em seus projetos.",
    criterionType: "panel_count",
    targetValue: 10,
    bonusAmount: 15,
    active: true,
    sortOrder: 20,
  },
  {
    key: "holding_10_days",
    title: "Mantenha um painel por 10 dias",
    description: "Complete 10 dias desde o registro de uma participação.",
    criterionType: "holding_days",
    targetValue: 10,
    bonusAmount: 10,
    active: true,
    sortOrder: 30,
  },
  {
    key: "holding_30_days",
    title: "Mantenha um painel por 30 dias",
    description: "Complete 30 dias desde o registro de uma participação.",
    criterionType: "holding_days",
    targetValue: 30,
    bonusAmount: 30,
    active: true,
    sortOrder: 40,
  },
];

export function goalProgress(
  goal: GoalDefinition,
  holdings: UserProject[],
  now = Date.now(),
) {
  const current =
    goal.criterionType === "panel_count"
      ? holdings.reduce((sum, holding) => sum + holding.quantity, 0)
      : holdings.reduce((longest, holding) => {
          const ownedSince = new Date(holding.createdAt).getTime();
          const days = Number.isFinite(ownedSince)
            ? Math.max(0, Math.floor((now - ownedSince) / 86400000))
            : 0;
          return Math.max(longest, days);
        }, 0);
  return {
    current,
    target: goal.targetValue,
    achieved: current >= goal.targetValue,
    percent: Math.min(100, Math.round((current / goal.targetValue) * 100)),
  };
}

export function isGoalKey(value: string): value is GoalKey {
  return demoGoalDefinitions.some((goal) => goal.key === value);
}
