import "server-only";

import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

const perfectPayWebhookSchema = z
  .object({
    token: z.string().min(1).max(512),
    code: z.string().min(1).max(255),
    sale_amount: z.coerce.number().nonnegative(),
    sale_status_enum: z.coerce.number().int(),
    currency_enum: z.coerce.number().int().optional(),
    payment_method_enum: z.coerce.number().int().optional(),
    installments: z.coerce.number().int().nonnegative().optional(),
    customer: z
      .object({
        email: z.string().min(1).max(255).optional(),
        full_name: z.string().optional(),
      })
      .passthrough()
      .optional(),
    product: z.record(z.string(), z.unknown()).optional(),
    plan: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type PerfectPayWebhookEvent = z.infer<typeof perfectPayWebhookSchema>;

export type PerfectPaySaleStatus =
  | "none"
  | "pending"
  | "approved"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "authorized"
  | "charged_back"
  | "completed"
  | "checkout_error"
  | "precheckout"
  | "expired"
  | "in_review"
  | "unknown";

const saleStatusByEnum: Record<number, PerfectPaySaleStatus> = {
  0: "none",
  1: "pending",
  2: "approved",
  3: "in_process",
  4: "in_mediation",
  5: "rejected",
  6: "cancelled",
  7: "refunded",
  8: "authorized",
  9: "charged_back",
  10: "completed",
  11: "checkout_error",
  12: "precheckout",
  13: "expired",
  16: "in_review",
};

function safeSecretEqual(received: string, expected: string) {
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getPerfectPayServerConfig() {
  return {
    apiTokenConfigured: Boolean(process.env.PERFECTPAY_API_TOKEN?.trim()),
    webhookTokenConfigured: Boolean(
      process.env.PERFECTPAY_WEBHOOK_TOKEN?.trim(),
    ),
  };
}

export async function readVerifiedPerfectPayWebhook(request: Request) {
  const expectedToken = process.env.PERFECTPAY_WEBHOOK_TOKEN?.trim();
  if (!expectedToken) {
    throw new PerfectPayWebhookError(
      "Webhook Perfect Pay preparado, mas o token de postback ainda não foi configurado.",
      503,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new PerfectPayWebhookError("JSON inválido.", 400);
  }

  const parsed = perfectPayWebhookSchema.safeParse(body);
  if (!parsed.success) {
    throw new PerfectPayWebhookError("Payload Perfect Pay inválido.", 400);
  }

  if (!safeSecretEqual(parsed.data.token, expectedToken)) {
    throw new PerfectPayWebhookError("Webhook não autorizado.", 401);
  }

  return {
    event: parsed.data,
    status: saleStatusByEnum[parsed.data.sale_status_enum] ?? "unknown",
  };
}

export class PerfectPayWebhookError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PerfectPayWebhookError";
  }
}
