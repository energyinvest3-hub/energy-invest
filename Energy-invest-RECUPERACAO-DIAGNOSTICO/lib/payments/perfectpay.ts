import "server-only";

import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

const perfectPayWebhookSchema = z
  .object({
    token: z.string().min(1).max(512),
    code: z.string().min(1).max(255),
    sale_amount: z.coerce.number().positive(),
    sale_status_enum: z.coerce.number().int(),
    sale_status_detail: z.string().optional(),
    currency_enum: z.coerce.number().int().optional(),
    payment_method_enum: z.coerce.number().int().optional(),
    payment_type_enum: z.coerce.number().int().optional(),
    installments: z.coerce.number().int().nonnegative().optional(),
    date_created: z.string().optional(),
    date_approved: z.string().nullable().optional(),
    customer: z
      .object({
        email: z.string().min(1).max(255).optional(),
        full_name: z.string().optional(),
        identification_type: z.string().optional(),
        identification_number: z.string().optional(),
      })
      .passthrough()
      .optional(),
    product: z
      .object({
        code: z.union([z.string(), z.number()]).optional(),
        name: z.string().optional(),
        external_reference: z.string().nullable().optional(),
      })
      .passthrough()
      .optional(),
    plan: z
      .object({
        code: z.union([z.string(), z.number()]).optional(),
        name: z.string().optional(),
        quantity: z.coerce.number().int().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type PerfectPayWebhookEvent =
  z.infer<typeof perfectPayWebhookSchema>;

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

function normalizeCode(value: unknown) {
  if (value === undefined || value === null) return null;
  const code = String(value).trim();
  return code || null;
}

function assertPerfectPayUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL de checkout da Perfect Pay inválida.");
  }

  if (
    url.protocol !== "https:" ||
    !(
      url.hostname === "go.perfectpay.com.br" ||
      url.hostname === "pagamento.perfectpay.com.br" ||
      url.hostname.endsWith(".perfectpay.com.br")
    )
  ) {
    throw new Error(
      "O checkout precisa apontar para um domínio HTTPS da Perfect Pay.",
    );
  }

  return url.toString();
}

export function getPerfectPayExpectedCodes() {
  return {
    productCode: process.env.PERFECTPAY_PRODUCT_CODE?.trim() || null,
    planCode: process.env.PERFECTPAY_PLAN_CODE?.trim() || null,
  };
}

export function getPerfectPayCheckoutUrl(amount: number) {
  const rounded = Math.round(amount * 100) / 100;
  const mapRaw = process.env.PERFECTPAY_CHECKOUTS_JSON?.trim();

  if (mapRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(mapRaw);
    } catch {
      throw new Error("PERFECTPAY_CHECKOUTS_JSON não contém JSON válido.");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(
        "PERFECTPAY_CHECKOUTS_JSON deve ser um objeto de valor -> URL.",
      );
    }

    const map = parsed as Record<string, unknown>;
    const candidate =
      map[rounded.toFixed(2)] ?? map[String(rounded)];

    if (typeof candidate === "string" && candidate.trim()) {
      return assertPerfectPayUrl(candidate.trim());
    }
  }

  const fallback = process.env.PERFECTPAY_CHECKOUT_URL?.trim();
  if (!fallback) {
    throw new Error(
      "Configure PERFECTPAY_CHECKOUT_URL ou PERFECTPAY_CHECKOUTS_JSON na Vercel.",
    );
  }
  return assertPerfectPayUrl(fallback);
}

export function getPerfectPayServerConfig() {
  return {
    apiTokenConfigured: Boolean(
      process.env.PERFECTPAY_API_TOKEN?.trim(),
    ),
    webhookTokenConfigured: Boolean(
      process.env.PERFECTPAY_WEBHOOK_TOKEN?.trim(),
    ),
    checkoutConfigured: Boolean(
      process.env.PERFECTPAY_CHECKOUT_URL?.trim() ||
        process.env.PERFECTPAY_CHECKOUTS_JSON?.trim(),
    ),
    ...getPerfectPayExpectedCodes(),
  };
}

export async function readVerifiedPerfectPayWebhook(request: Request) {
  const expectedToken =
    process.env.PERFECTPAY_WEBHOOK_TOKEN?.trim();

  if (!expectedToken) {
    throw new PerfectPayWebhookError(
      "PERFECTPAY_WEBHOOK_TOKEN não configurado.",
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
    throw new PerfectPayWebhookError(
      "Payload Perfect Pay inválido.",
      400,
    );
  }

  if (!safeSecretEqual(parsed.data.token, expectedToken)) {
    throw new PerfectPayWebhookError("Webhook não autorizado.", 401);
  }

  return {
    event: parsed.data,
    status:
      saleStatusByEnum[parsed.data.sale_status_enum] ?? "unknown",
    productCode: normalizeCode(parsed.data.product?.code),
    planCode: normalizeCode(parsed.data.plan?.code),
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
