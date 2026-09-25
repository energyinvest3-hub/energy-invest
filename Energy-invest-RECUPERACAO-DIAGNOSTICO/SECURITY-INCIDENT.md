

## Antes de reativar PIX

1. Mantenha `DEPOSITS_DISABLED=true`.
2. Vercel Firewall:
   - Attack Mode durante o incidente.
   - Bot Protection ativo.
   - bloqueio do IP abusivo.
   - `/api/actions` + `POST`: rate limit temporário de 30 req / 60 s / IP.
3. Rode `supabase/security-hardening.sql` no SQL Editor da Supabase.
4. Confirme que o trigger foi criado:
   ```sql
   select tgname
   from pg_trigger
   where tgrelid='public.deposits'::regclass
     and not tgisinternal;
   ```
5. Deixe o repositório GitHub PRIVATE.
6. Revogue/rotacione qualquer segredo que já tenha sido exposto fora de variáveis de ambiente.
   - service role
   - chaves da SyncPay
   - tokens externos
   O `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` é público por design; service-role NÃO é.
7. O source da Edge Function `syncpay-cash-in` precisa ser revisado antes de liberar.
   Ela deve:
   - exigir JWT válido;
   - validar o usuário no servidor;
   - ter rate limit persistente;
   - impedir mais de 1 PIX pendente;
   - idealmente exigir uma credencial interna da aplicação, além do JWT, se só a Vercel deve chamá-la.
8. Só depois mude `DEPOSITS_DISABLED=false` e faça redeploy.

## Recuperação dos depósitos apagados

### Melhor opção
Supabase > Database > Backups > Restore to a New Project.

Escolha um backup imediatamente anterior ao incidente. NÃO restaure produção por cima de primeira,
porque isso também volta usuários, saldos e operações legítimas posteriores ao backup.

No projeto restaurado:
- exporte `public.deposits`;
- compare por `id` com produção;
- importe somente linhas ausentes.

Se houver PITR, escolha um instante imediatamente anterior ao início do flood.

### Fallback sem backup
Use `supabase/recover-missing-deposits.sql`.

Ele usa `public.transactions` como ledger para reconstruir depósitos `completed` ausentes.
Ele NÃO altera saldo de carteira, evitando crédito duplicado.

Limitação:
`gateway_id`, `pix_code` e horário exato do provedor só podem ser recuperados de backup/PITR
ou do histórico da SyncPay.

## Investigação

O schema atual concede ao usuário autenticado apenas leitura de `public.deposits`.
Não há grant normal de DELETE para `authenticated`.
Se linhas realmente foram excluídas, investigue:
- service-role exposto;
- Edge Function usando service-role;
- ação no SQL Editor/dashboard;
- restore/migração;
- chave de API externa comprometida;
- paginação/limite de visualização confundido com exclusão.

Não assuma autoria sem logs.

