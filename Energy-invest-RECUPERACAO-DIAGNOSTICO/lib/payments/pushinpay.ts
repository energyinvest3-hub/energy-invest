import "server-only";

import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const pushinPayChargeSchema = z
  .object({
    id: z.string().min(1),
    qr_code: z.string().min(1),
    status: z.string().min(1),
    value: z.coerce.number().int().nonnegative(),
    webhook_url: z.string().nullable().optional(),
    qr_code_base64: z.string().min(1),
    end_to_end_id: z.string().nullable().optional(),
    payer_name: z.string().nullable().optional(),
    payer_national_registration: z.string().nullable().optional(),
  })
  .passthrough();

export const pushinPayWebhookSchema = z
  .object({
    id: z.string().min(1),
    value: z.coerce.number().int().nonnegative(),
    status: z.string().min(1),
    end_to_end_id: z.string().nullable().optional(),
  })
  .passthrough();

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configure ${name} no servidor.`);
  return value;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function getPushinPayConfig() {
  const baseUrl =
    process.env.PUSHINPAY_BASE_URL?.trim() ||
    "https://api.pushinpay.com.br/api";

  if (!baseUrl.startsWith("https://")) {
    throw new Error("PUSHINPAY_BASE_URL precisa usar HTTPS.");
  }

  return {
    apiToken: requiredEnv("PUSHINPAY_API_TOKEN"),
    webhookSecret: requiredEnv("PUSHINPAY_WEBHOOK_SECRET"),
    baseUrl: baseUrl.replace(/\/+$/, ""),
  };
}

export function pushinPayWebhookUrl(request: Request) {
  const { webhookSecret } = getPushinPayConfig();
  const explicit = process.env.PUSHINPAY_WEBHOOK_URL?.trim();
  const url = explicit
    ? new URL(explicit)
    : new URL("/api/webhooks/pushinpay", request.url);

  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("O webhook da PushinPay precisa usar HTTPS em produção.");
  }

  url.searchParams.set("token", webhookSecret);
  return url.toString();
}

export function verifyPushinPayWebhook(request: Request) {
  const received = new URL(request.url).searchParams.get("token") ?? "";
  const { webhookSecret } = getPushinPayConfig();
  return Boolean(received) && safeEqual(received, webhookSecret);
}

export function normalizePushinPayQr(value: string) {
  return value.startsWith("data:")
    ? value
    : `data:image/png;base64,${value}`;
}

export async function createPushinPayCharge(
  valueCents: number,
  webhookUrl: string,
) {
  const { apiToken, baseUrl } = getPushinPayConfig();

  const response = await fetch(`${baseUrl}/pix/cashIn`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      value: valueCents,
      webhook_url: webhookUrl,
      split_rules: [],
    }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message)
        : `PushinPay retornou HTTP ${response.status}.`;
    throw new Error(message);
  }

  const parsed = pushinPayChargeSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("A PushinPay retornou uma cobrança em formato inesperado.");
  }

  return parsed.data;
}
