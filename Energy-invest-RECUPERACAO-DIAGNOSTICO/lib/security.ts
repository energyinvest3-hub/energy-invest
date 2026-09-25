import "server-only";

type RateLimitOptions = {
  limit?: number;
  windowSeconds?: number;
  failClosed?: boolean;
};

export class RateLimitError extends Error {
  constructor(message = "Muitas tentativas. Aguarde um momento.") {
    super(message);
    this.name = "RateLimitError";
  }
}

const buckets = new Map<
  string,
  { count: number; reset: number }
>();

export function clientIp(request: Request) {
  const forwarded =
    request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function rateLimit(
  key: string,
  options: RateLimitOptions = {},
) {
  const limit = options.limit ?? 20;
  const windowSeconds =
    options.windowSeconds ?? 60;

  const url =
    process.env.UPSTASH_REDIS_REST_URL;

  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    const bucketWindow = Math.floor(
      Date.now() /
        (windowSeconds * 1000),
    );

    const bucket =
      `energy:${key}:${bucketWindow}`;

    const response = await fetch(
      `${url}/pipeline`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify([
          ["INCR", bucket],
          [
            "EXPIRE",
            bucket,
            windowSeconds + 5,
          ],
        ]),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(
        "Proteção temporariamente indisponível.",
      );
    }

    const data = await response.json();

    const count = data?.[0]?.result;

    if (typeof count !== "number") {
      throw new Error(
        "Proteção temporariamente indisponível.",
      );
    }

    if (count > limit) {
      throw new RateLimitError();
    }

    return;
  }

  // Para operações sensíveis, produção NÃO pode
  // depender de rate limit em memória.
  if (
    options.failClosed &&
    process.env.NODE_ENV === "production"
  ) {
    throw new Error(
      "Proteção de segurança indisponível. Tente novamente mais tarde.",
    );
  }

  const now = Date.now();
  const duration =
    windowSeconds * 1000;

  if (buckets.size > 10000) {
    buckets.clear();
  }

  const current =
    buckets.get(key);

  if (
    current &&
    current.reset > now
  ) {
    current.count += 1;

    if (current.count > limit) {
      throw new RateLimitError();
    }

    return;
  }

  buckets.set(key, {
    count: 1,
    reset: now + duration,
  });
}
