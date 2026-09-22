# EnergyInvest

Aplicação Next.js 16 + TypeScript, Tailwind CSS 4, Lucide, React Hook Form, Zod e Supabase SSR. Interface mobile-first com navegação inferior e composição própria para desktop. Logo e ícone fornecidos pelo cliente.

## Executar localmente

```bash
npm ci
cp .env.example .env.local
npm run dev -- --port 3005
```

Abra http://localhost:3005. O `.env.example` ativa somente a demonstração isolada (`DEMO_MODE=true`). A demonstração tem saldo zero, não usa localStorage e mantém sessões temporárias em memória no servidor. Dados de demonstração são descartáveis e podem desaparecer ao reiniciar o servidor; não são banco de produção. Nunca use dados pessoais reais no modo demonstrativo.

## Entregue

- Dashboard, catálogo com 12 projetos ilustrativos nacionais e internacionais, filtros por região/status e busca. A participação mínima configurável começa em R$ 50.
- Detalhe do projeto, modal acessível com quantidade, limites, aceite e participação simulada.
- Meus painéis, filtros, detalhe com progresso e cronograma de créditos.
- Carteira, histórico e recarga PIX real via SyncPay com QR Code/copia e cola dentro do site, confirmação por webhook e crédito automático idempotente. Saques continuam desativados.
- Janela de solicitação de saque todos os dias, das 09h às 18h no horário de Brasília, validada na interface e no servidor.
- Perfil editável, segurança, notificações, suporte, textos legais preliminares.
- Perfil com atalhos e Central de metas por quantidade de painéis e tempo de participação.
- Cadastro, login e recuperação sem CAPTCHA nesta versão de teste; validações de senha, termos e rate limit continuam ativas.
- Bônus promocionais configuráveis, solicitação validada pelo servidor, fila administrativa e crédito atômico com transação e auditoria.
- Admin autenticado com role ADMIN em app_metadata; indicadores de investidores, entradas e saídas confirmadas, pessoas pagas, pendências, cronologia de atividades, auditoria e gestão de projetos.
- Banco com RLS, isolamento de dados, privilégios por coluna e estimativa total calculada pelo Postgres.
- Adapter `PaymentGateway` para a demonstração, integração SyncPay para recargas PIX reais e receptor Perfect Pay mantido separadamente para vendas.
- Manifest PWA, ícones, safe area e viewport. Não há cache offline de dados financeiros ou service worker; preparação PWA, não operação offline.

## Supabase conectado

O ambiente atual foi conectado ao projeto Supabase `rthagtoomnygcblugyxc`, na região `sa-east-1`. As tabelas, RLS, funções financeiras atômicas e a integração SyncPay já foram aplicadas nesse projeto.

Para recriar em outro projeto no futuro:

1. Execute `supabase/schema.sql` e depois `supabase/syncpay.sql`. `seed.sql` é opcional e exclusivamente demonstrativo.
2. Ative Supabase Cron e execute `supabase/cron.sql` para processar créditos vencidos a cada 15 minutos.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Defina `DEMO_MODE=false`.
5. As credenciais da SyncPay devem ficar no Supabase Vault, nunca no frontend ou no repositório.
6. Configure email/senha e confirmação de e-mail no Supabase. Configure SMTP e as URLs de redirecionamento `/auth/callback` e `/auth/callback?next=/redefinir-senha` no domínio final.
8. Configure `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WHATSAPP_GROUP_URL` e o rate limiter distribuído `UPSTASH_REDIS_REST_URL/TOKEN`. Operações reais falham fechadas sem limitador em produção.
9. Para o primeiro administrador, atribua `app_metadata.role = ADMIN` pela API administrativa/dashboard Supabase com privilégios de operador. Nunca por user_metadata ou frontend. As políticas revalidam a role atual no banco.

O cadastro implementado usa e-mail/senha; telefone fica no perfil. Login por telefone só funciona para identidades telefônicas verificadas e provisionadas no Supabase Auth com provedor SMS configurado. Não existe busca pública de e-mail por telefone.

## Segurança e pagamentos

O modo real permite autenticação, leitura, perfil/admin, participação e recarga de saldo por PIX via SyncPay. A função `purchase_solar_project` ignora valores do cliente, trava projeto e carteira, valida saldo/limites, debita o valor configurado no banco e cria o cronograma de créditos em uma única transação. Depósitos PIX reais estão habilitados via SyncPay. Saques reais permanecem bloqueados. O modo demonstração permite simular participação sem saldo, com indicação explícita e sem direito financeiro. As duas experiências não compartilham dados.

Financeiro não concede INSERT/UPDATE direto a `anon/authenticated`, inclusive ADMIN. As únicas alterações permitidas passam por funções específicas que recalculam valores, validam identidade e executam de forma atômica. O schema inicial cria carteira zerada por trigger confiável de `auth.users`.

As quatro metas iniciais e seus valores de bônus ficam em `goal_definitions`, não nos componentes. Ao atingir uma meta, `claim_goal_reward` recalcula quantidade de cotas ou dias de participação no banco e cria uma recompensa pendente. O usuário não consegue creditar o próprio saldo. Somente um ADMIN atual pode executar `credit_goal_reward`, que bloqueia a recompensa, credita a carteira, grava a transação de bônus e o log de auditoria na mesma transação do Postgres. Os valores incluídos são configuração inicial demonstrativa e devem ser revisados pelo operador antes do lançamento.

### SyncPay

A recarga PIX usa a API pública SyncPay. O backend gera o Bearer pelo `client_id/client_secret`, cria a cobrança em `/api/partner/v1/cash-in` e recebe `pix_code` + `identifier`. O QR Code é renderizado no próprio site e o usuário não precisa sair da EnergyInvest.

As credenciais fornecidas não ficam no repositório: foram armazenadas no Supabase Vault. A Edge Function `syncpay-cash-in` exige JWT de usuário e cria a cobrança. A função pública `syncpay-webhook` aceita a notificação da SyncPay, mas não confia no payload: ela consulta novamente `/api/partner/v2/transactions/{reference_id}` e só depois chama uma função SQL idempotente que confere identificador, valor e status antes de creditar a carteira.

O mesmo `identifier` não pode creditar duas vezes. O depósito, a carteira, a transação e a notificação são reconciliados no banco. Status positivos `completed` e `paid` liberam saldo; `expired`/`failed` e equivalentes cancelam a pendência.

### Perfect Pay

A integração foi preparada de acordo com a documentação oficial sem transformar a Perfect Pay em um gateway de recarga de carteira. A API documentada é voltada à consulta de vendas, comissões, produtos e extrato; o token pessoal deve ficar exclusivamente no servidor em `PERFECTPAY_API_TOKEN`. O endpoint `/api/webhooks/payment` valida o token de postback recebido no payload usando `PERFECTPAY_WEBHOOK_TOKEN` e normaliza o status da venda, mas **não** credita saldo.

O token de API e o token de webhook são credenciais diferentes. Nenhuma chave secreta deve usar prefixo `NEXT_PUBLIC_` e nenhuma credencial real é distribuída neste repositório. Para uma venda legítima de produto pela Perfect Pay, configure o Webhook - Vendas no painel apontando para `/api/webhooks/payment`.

Saques de carteira continuam bloqueados. A recarga PIX usa persistência idempotente, reconciliação com a API da SyncPay, transações SQL e locks antes de alterar saldo.

As ofertas e valores fornecidos são ilustrativos; não foram validados como projetos ou produtos financeiros reais. Textos legais e atendimento precisam ser concluídos pelo operador antes de uso público.

## Estrutura

- `app/(platform)/`: páginas autenticadas (ou sandbox explícito) e admin.
- `app/api/`: autenticação, ações, admin e integração do front com a Edge Function de recarga PIX.
- `components/`: shell, UI, projetos, dashboard, carteira, perfil, autenticação e admin.
- `lib/`: modelos, configurações de projetos, formatação, validação, dados, segurança e clientes Supabase.
- `services/`: contratos e chamadas de serviços.
- `supabase/`: schema com RLS, integração SyncPay, funções Edge e seeds ilustrativos.
- `public/`: logo/favicon originais e imagens solares licenciadas.

## Validação

```bash
npm run lint
npm run typecheck
npm run build
```

Build usa Webpack, suportado pelo Next.js, para evitar limitações de subprocessos do Turbopack neste ambiente. Typecheck e build não exigem credenciais. Veja `VALIDACAO.md` para evidências e limitações dos testes.

A aplicação é preparada para hospedar em Node.js/Vercel via `next start` ou o output standalone. Hospedagem pública não foi configurada. Não converter em export estático: os recursos de autenticação e as APIs exigem servidor.

## Imagens

Imagens ilustrativas, não fotografias verificadas dos projetos listados:
- Gabriel / Unsplash: https://unsplash.com/photos/riFb-zdJ5QA
- Soren H / Unsplash: https://unsplash.com/photos/omfN1pW-n2Y
- Rafael Moreno / Unsplash: https://unsplash.com/photos/73JOOymZQTQ
- Licença: https://unsplash.com/license

## Painel administrativo

A rota `/admin` usa `public.admin_dashboard_snapshot()` para carregar os módulos administrativos sem depender de consultas RLS independentes. O painel inclui usuários, carteiras, projetos, participações, depósitos, saques, créditos, indicações, transações, auditoria e configurações do programa de indicação.

Ações financeiras administrativas geram histórico/auditoria. Depósitos SyncPay não podem ser manualmente transformados em pagos; use a ação de conciliação para consultar o gateway. Projetos com participações não podem ser apagados, apenas pausados/finalizados.

## Recuperação de senha

O fluxo de senha usa o Supabase Auth:
1. `/recuperar-senha` solicita o e-mail.
2. O servidor chama `resetPasswordForEmail` com retorno para `/auth/callback`.
3. O callback troca o código por uma sessão de recuperação e redireciona para `/redefinir-senha`.
4. A nova senha é salva via `updateUser` e a sessão de recuperação é encerrada.
5. O usuário volta ao login e entra com a nova senha.

No Supabase Auth, o domínio de produção deve estar autorizado em **URL Configuration / Redirect URLs**. Para previews do Vercel, autorize o domínio de preview usado nos testes ou use um domínio estável de produção.
