import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  getPerfectPayCheckoutUrl,
  getPerfectPayExpectedCodes,
} from "./perfectpay";

function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export async function createPerfectPayDeposit(
  db: SupabaseClient,
  user: User,
  input: { amount: number; cpf: string },
) {
  const email = user.email?.trim().toLowerCase();
  const cpf = normalizeCpf(input.cpf);
  const amount = Math.round(input.amount * 100) / 100;

  if (!email) {
    throw new Error(
      "Sua conta precisa ter um e-mail válido para pagar pela Perfect Pay.",
    );
  }
  if (cpf.length !== 11) {
    throw new Error("Informe um CPF válido.");
  }

  const checkoutUrl = getPerfectPayCheckoutUrl(amount);
  const { productCode, planCode } = getPerfectPayExpectedCodes();

  const { data, error } = await db.rpc("create_perfectpay_deposit", {
    p_amount: amount,
    p_cpf: cpf,
    p_customer_email: email,
    p_checkout_url: checkoutUrl,
    p_expected_product_code: productCode,
    p_expected_plan_code: planCode,
  });

  if (error) {
    throw new Error(
      error.message || "Não foi possível iniciar o pagamento.",
    );
  }

  const deposit = Array.isArray(data) ? data[0] : data;
  if (!deposit?.id) {
    throw new Error("A cobrança foi criada sem identificador.");
  }

  return {
    deposit: {
      id: String(deposit.id),
      identifier: String(deposit.id),
      amount: Number(deposit.amount),
      status: deposit.status as "pending" | "completed" | "cancelled",
      providerStatus: deposit.provider_status ?? "pending",
      checkoutUrl: deposit.checkout_url ?? checkoutUrl,
      saleCode: deposit.provider_sale_code ?? null,
      reversalPending: Boolean(deposit.reversal_pending),
    },
  };
}

export async function getPerfectPayDepositStatus(
  db: SupabaseClient,
  userId: string,
  depositId: string,
) {
  const { data: deposit, error } = await db
    .from("deposits")
    .select(
      "id,amount,status,provider_status,provider_sale_code,checkout_url,paid_at,reversal_pending,reversed_at",
    )
    .eq("id", depositId)
    .eq("user_id", userId)
    .eq("provider", "perfectpay")
    .single();

  if (error || !deposit) {
    throw new Error("Pagamento não encontrado.");
  }

  return {
    deposit: {
      id: String(deposit.id),
      identifier: String(deposit.id),
      amount: Number(deposit.amount),
      status: deposit.status as "pending" | "completed" | "cancelled",
      providerStatus: deposit.provider_status ?? "pending",
      checkoutUrl: deposit.checkout_url ?? null,
      saleCode: deposit.provider_sale_code ?? null,
      paidAt: deposit.paid_at ?? null,
      reversalPending: Boolean(deposit.reversal_pending),
      reversedAt: deposit.reversed_at ?? null,
    },
  };
}
