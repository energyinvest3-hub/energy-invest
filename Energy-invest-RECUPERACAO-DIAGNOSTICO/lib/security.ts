import "server-only";

const buckets = new Map<string, { count: number; reset: number }>();

export async function rateLimit(key: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    const bucket = `energy:${key}:${Math.floor(Date.now() / 60000)}`;
    const r = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", bucket],
        ["EXPIRE", bucket, 65],
      ]),
    });
    if (!r.ok) throw new Error("Proteção temporariamente indisponível.");
    const data = await r.json();
    if (data[0]?.error || typeof data[0]?.result !== "number")
      throw new Error("Proteção indisponível.");
    if (data[0].result > 20)
      throw new Error("Muitas tentativas. Aguarde um minuto.");
    return;
  }

  // Fallback local para o ambiente de teste sem serviço externo. Em produção,
  // prefira um limitador distribuído para compartilhar contagens entre regiões.
  const now = Date.now();
  if (buckets.size > 10000) buckets.clear();
  const b = buckets.get(key);
  if (b && b.reset > now) {
    if (++b.count > 20)
      throw new Error("Muitas tentativas. Aguarde um minuto.");
  } else {
    buckets.set(key, { count: 1, reset: now + 60000 });
  }
}
