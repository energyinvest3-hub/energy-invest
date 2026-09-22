import "server-only";
import type {
  PaymentGateway,
  DepositResponse,
  WithdrawalRequest,
} from "@/services/paymentGateway";
/** Non-settling sandbox adapter. Never credits a wallet or emits payment instructions. */
export class MockPaymentGateway implements PaymentGateway {
  private readonly deposits = new Map<string, DepositResponse>();
  private readonly withdrawals = new Map<string, DepositResponse>();
  async createDeposit(amount: number): Promise<DepositResponse> {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000)
      throw new Error("Valor inválido.");
    const result: DepositResponse = {
      id: crypto.randomUUID(),
      amount: Math.round(amount * 100) / 100,
      status: "pending",
      simulated: true,
    };
    if (this.deposits.size >= 1000)
      this.deposits.delete(this.deposits.keys().next().value!);
    this.deposits.set(result.id, result);
    return { ...result };
  }
  async getDeposit(id: string): Promise<DepositResponse> {
    const result = this.deposits.get(id);
    if (!result)
      throw new Error("Solicitação simulada não encontrada ou expirada.");
    return { ...result };
  }
  async getDepositStatus(id: string) {
    return (await this.getDeposit(id)).status;
  }
  async requestWithdrawal(data: WithdrawalRequest) {
    if (!Number.isFinite(data.amount) || data.amount <= 0)
      throw new Error("Valor inválido.");
    const result: DepositResponse = {
      id: crypto.randomUUID(),
      amount: Math.round(data.amount * 100) / 100,
      status: "pending",
      simulated: true,
    };
    if (this.withdrawals.size >= 1000)
      this.withdrawals.delete(this.withdrawals.keys().next().value!);
    this.withdrawals.set(result.id, result);
    return { ...result };
  }
  async getWithdrawal(id: string) {
    const result = this.withdrawals.get(id);
    if (!result)
      throw new Error("Solicitação simulada não encontrada ou expirada.");
    return { ...result };
  }
  async handleWebhook() {
    throw new Error("Gateway real ainda não configurado.");
  }
}
export const paymentGateway: PaymentGateway = new MockPaymentGateway();
