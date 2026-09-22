export type DepositStatus = "pending" | "completed" | "cancelled";
export interface DepositResponse {
  id: string;
  amount: number;
  status: DepositStatus;
  simulated: boolean;
}
export interface WithdrawalRequest {
  amount: number;
  pixKey: string;
  pixKeyType: "cpf" | "email" | "phone" | "random";
}
export type WithdrawalResponse = DepositResponse;
export interface PaymentGateway {
  createDeposit(amount: number): Promise<DepositResponse>;
  getDeposit(id: string): Promise<DepositResponse>;
  getDepositStatus(id: string): Promise<DepositStatus>;
  requestWithdrawal(data: WithdrawalRequest): Promise<WithdrawalResponse>;
  getWithdrawal(id: string): Promise<WithdrawalResponse>;
  handleWebhook(request: Request): Promise<void>;
}
