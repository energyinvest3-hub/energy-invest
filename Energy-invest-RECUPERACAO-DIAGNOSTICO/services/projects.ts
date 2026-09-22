export async function performAction(body: Record<string, unknown>) {
  const r = await fetch("/api/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error ?? "Não foi possível concluir.");
  return result;
}
export const purchaseProject = (projectId: string, quantity: number) =>
  performAction({ action: "purchase", projectId, quantity, accepted: true });
export const createDeposit = (amount: number, cpf: string) =>
  performAction({ action: "deposit", amount, cpf });
export const getDepositStatus = (id: string) =>
  performAction({ action: "depositStatus", id });
