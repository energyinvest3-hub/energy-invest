export const premiumPlanStartAt = "2026-10-02T16:36:00-03:00";
export const premiumPlanMinDeposit = 50;

export function premiumPlanDepositTotal(
  transactions: Array<{
    type: string;
    status: string;
    amount: number;
    createdAt: string;
  }>,
) {
  const start = new Date(premiumPlanStartAt).getTime();

  return transactions
    .filter(
      (transaction) =>
        transaction.type === "deposit" &&
        transaction.status === "completed" &&
        new Date(transaction.createdAt).getTime() >= start,
    )
    .reduce(
      (total, transaction) =>
        total + Math.max(0, Number(transaction.amount) || 0),
      0,
    );
}
