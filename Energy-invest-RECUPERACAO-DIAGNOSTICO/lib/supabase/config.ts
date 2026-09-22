/**
 * Public Supabase configuration for EnergyInvest.
 * These values are intentionally public: browser clients require them.
 * Environment variables still take precedence in deployments.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://rthagtoomnygcblugyxc.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_bdxrmmtvdxSD5ZPxTEWi2g_hj7R3C8D";
