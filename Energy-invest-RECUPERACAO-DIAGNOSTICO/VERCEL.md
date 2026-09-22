# Deploy no Vercel

Esta versão foi preparada para o Vercel/Next.js.

## Correção aplicada

As Edge Functions `syncpay-cash-in` e `syncpay-webhook` já estão implantadas no Supabase e seus arquivos TypeScript/Deno não fazem parte deste pacote de build. Isso evita que o compilador do Next.js tente interpretar `Deno`, `jsr:` ou imports `npm:` do runtime do Supabase.

O `tsconfig.json` também limita o type-check aos arquivos da aplicação Next.js e exclui `supabase/**`.

## Variáveis do Vercel

Configure em Project Settings > Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL` (URL final do site)
- `DEMO_MODE=false`

Esta versão de teste não usa CAPTCHA no frontend nem na API. Mantenha a
proteção CAPTCHA desativada também em Authentication > Attack Protection no
Supabase enquanto estiver validando o cadastro.

O `client_id` e o `client_secret` da SyncPay NÃO devem ser adicionados ao Vercel. Eles já estão armazenados no Supabase Vault.

## GitHub

Se o repositório mantiver o app dentro da pasta `energyinvest-syncpay-conectado`, deixe essa pasta configurada como **Root Directory** no projeto Vercel.
