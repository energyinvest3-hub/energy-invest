/**
 * Supabase configuration for EnergyInvest.
 *
 * All connections (browser, server, admin) must use the Supabase project
 * configured in the deployment environment. Never fall back to the
 * previous database, which would silently return an empty project catalog.
 */
function requirePublicSetting(name: string, value: string | undefined): string {
  const cleaned = value?.trim();
  if (!cleaned) {
    throw new Error(`EnergyInvest: configure ${name} no ambiente de deploy.`);
  }
  return cleaned;
}

export const SUPABASE_URL = requirePublicSetting(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_PUBLISHABLE_KEY = requirePublicSetting(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY)",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

let projectUrl: URL;
try {
  projectUrl = new URL(SUPABASE_URL);
} catch {
  throw new Error("EnergyInvest: NEXT_PUBLIC_SUPABASE_URL é inválida.");
}

if (
  projectUrl.protocol !== "https:" ||
  projectUrl.hostname === "rthagtoomnygcblugyxc.supabase.co"
) {
  throw new Error(
    "EnergyInvest: o endereço Supabase é inseguro ou aponta para o banco antigo. Configure o banco novo na Vercel.",
  );
}
