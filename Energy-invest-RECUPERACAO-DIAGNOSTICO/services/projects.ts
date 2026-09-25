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
async function performPaymentAction(
  path: string,
  body: Record<string, unknown>,
) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await r.json();
  if (!r.ok) {
    throw new Error(
      result.error ?? "Não foi possível concluir o pagamento.",
    );
  }
  return result;
}

export const createDeposit = (amount: number, cpf: string) =>
  performPaymentAction("/api/payments/perfectpay/deposit", {
    amount,
    cpf,
  });

export const getDepositStatus = (id: string) =>
  performPaymentAction("/api/payments/perfectpay/status", {
    id,
  });
