# Supabase Edge Functions

The SyncPay Edge Functions are deployed directly in the connected Supabase project and are intentionally not shipped inside the Vercel/Next.js application package.

Deployed functions:
- `syncpay-cash-in`
- `syncpay-webhook`

This prevents Next.js/Vercel TypeScript from attempting to compile Deno-only sources (`Deno`, `jsr:`, and `npm:` specifiers).
