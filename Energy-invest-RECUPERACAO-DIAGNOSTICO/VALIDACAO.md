## Correção de deploy Vercel — 21/09/2026

- O build do Vercel estava incluindo `supabase/functions/**/*.ts` no `tsconfig.json` do Next.js.
- Essas funções executam no Supabase Edge Runtime (Deno) e usam imports `jsr:`/`npm:`, portanto não devem ser compiladas pelo TypeScript do Next/Vercel.
- `tsconfig.json` foi corrigido para excluir `supabase/functions/**` do build da aplicação web.
- As Edge Functions continuam versionadas no projeto e permanecem implantadas/ativas na Supabase; a alteração afeta somente o type-check do Vercel.
- A tentativa de repetir `npm ci && npm run build` neste ambiente foi bloqueada por falha DNS `EAI_AGAIN` para `registry.npmjs.org`; não foi encontrado um novo diagnóstico de código após a correção.

## Integração SyncPay + Supabase — 21/09/2026

- Projeto Supabase conectado: `rthagtoomnygcblugyxc` (`sa-east-1`).
- Credenciais SyncPay armazenadas no Supabase Vault; não foram gravadas no código ou no ZIP.
- Edge Functions ativas: `syncpay-cash-in` (JWT obrigatório) e `syncpay-webhook` (webhook público com reconciliação server-to-server).
- Cobrança PIX: `POST /api/partner/v1/cash-in`; retorno utilizado: `pix_code` e `identifier`.
- QR Code é gerado no backend e exibido diretamente na página de recarga, com botão PIX copia e cola.
- Webhook não credita saldo com base apenas no payload recebido: consulta `/api/partner/v2/transactions/{reference_id}` na SyncPay e confere identificador, método PIX, valor e status.
- Liquidação é idempotente e atômica no Postgres: depósito, carteira, transação e notificação são atualizados uma única vez.
- `completed` e `paid` liberam saldo; estados de expiração/falha cancelam a pendência.
- Saques reais continuam desativados.
- A tentativa de testar as credenciais diretamente do container local ficou bloqueada por DNS do ambiente. A documentação pública foi acessada normalmente e as Edge Functions foram implantadas com sucesso no Supabase.
- Varredura final confirmou que `client_id` e `client_secret` reais da SyncPay não aparecem em nenhum arquivo do projeto; apenas os nomes das entradas do Vault são versionados.
- As Edge Functions `syncpay-cash-in` e `syncpay-webhook` foram relidas do projeto remoto e constam como ACTIVE.
- O TypeScript global analisou os arquivos alterados sem diagnóstico de sintaxe; a resolução completa de módulos não pôde ser refeita porque `npm ci` não conseguiu acessar o registry neste ambiente.


## Preparação Perfect Pay — 21/09/2026

- A documentação oficial foi revisada: a API é voltada a consultas de vendas, comissões, produtos e extrato; o checkout/postback é um fluxo separado.
- `PERFECTPAY_API_TOKEN` foi adicionado apenas como variável server-side de configuração; nenhum token real foi gravado no repositório.
- `/api/webhooks/payment` agora valida o token de postback em comparação de tempo constante e faz parsing do payload Perfect Pay.
- O token pessoal/API não é reutilizado como token de webhook; `PERFECTPAY_WEBHOOK_TOKEN` é uma credencial separada.
- Eventos válidos retornam `202` e são reconhecidos, porém não alteram carteira, saldo, depósito, crédito ou saque.
- O receptor Perfect Pay continua sem alterar carteira; as recargas reais passam exclusivamente pela integração SyncPay.

# Validação e entrega

## Cadastro sem CAPTCHA — 22/09/2026

- CAPTCHA removido do formulário, schema e rota de autenticação.
- O botão Criar conta depende somente do envio em andamento; configuração ausente agora retorna uma mensagem em vez de deixar o botão travado.
- Variáveis públicas do Supabase configuradas no projeto Vercel `energyinvest-sem-captcha` para produção, preview e desenvolvimento.
- Cadastro verificado no navegador: conteúdo renderizado, botão ativo, nenhum texto de CAPTCHA, nenhum overlay e nenhum erro de console.
- Requisição chegou ao Supabase sem erro de CAPTCHA; um e-mail de domínio reservado foi corretamente rejeitado como `email_address_invalid`.
- `npm run lint`, `npm run typecheck` e `npm run build`: aprovados.

## Atualização de metas e bônus — 20/09/2026

- Metas alteradas para 5 painéis, 10 painéis, 10 dias e 30 dias de participação.
- Solicitação de bônus testada antes e depois do critério, incluindo idempotência.
- Crédito real de bônus fica restrito ao RPC administrativo atômico e não é executado pelo cliente.
- Baseline anterior: `npm run lint`, `npm run typecheck` e `npm run build` haviam sido aprovados antes desta alteração.
- Baseline anterior: 19 rotas, cálculo de preço, limites, bônus validado no servidor, isolamento de sessão e admin negado.
- Inspeção visual mobile da Central de metas concluída em `http://localhost:3005/perfil/metas`.


## Atualização de catálogo, carteira e perfil — 21/09/2026

- Investimento mínimo por cota alterado para R$ 50 na validação, dados e constraint do banco.
- Catálogo ampliado para 12 cenários: Brasil, Europa, EUA e China, incluindo participações de R$ 500 a R$ 2.000.
- Projeções continuam identificadas como estimativas sem garantia; os cenários internacionais não representam instalações verificadas.
- Processador idempotente de créditos criado em `private.process_due_project_credits`, com carteira, painel, transação e notificação atualizados sob controle do banco.
- Agendamento de 15 minutos preparado em `supabase/cron.sql` e separado do bootstrap para ativação explícita no projeto correto.
- Janela de saque configurada para todos os dias, das 09h às 18h, em `America/Sao_Paulo`, na interface e na API.
- WhatsApp configurado por variável para `+55 11 97769-2699`, com novo ícone vetorial.
- Os 14 atalhos da referência foram incluídos no perfil, com páginas informativas para recursos ainda não ativados.
- Antes da preparação Perfect Pay, `npm run lint`, `npm run typecheck`, `npm run build` e o teste HTTP de 19 rotas haviam passado.

## Projeto inicial

A pasta original não continha código, banco, autenticação ou componentes. O projeto foi criado em `outputs/energyinvest` sem substituir arquivos de uma aplicação existente.

## Verificações executadas

- Baseline anterior: lint, typecheck, build Next.js 16.3.5/Webpack e teste HTTP de 19 rotas estavam aprovados.
- Alteração Perfect Pay desta entrega: arquivos TypeScript/TSX alterados passaram por validação sintática com TypeScript 5.8.3 e `tests/integration.mjs` passou em `node --check`. O build completo não foi reexecutado neste ambiente porque o registry do npm não resolveu DNS durante a reinstalação das dependências.
- Schema e 12 seeds executados em Postgres embarcado (PGlite), com roles equivalentes a Supabase: criação de carteira zerada, isolamento RLS entre dois usuários, proibição de alterações financeiras/email, edição permitida de nome, compra atômica de R$ 50, cinco créditos agendados processados uma única vez, escalada por user_metadata bloqueada, administração por app_metadata e revogação imediata. O retorno total de 20 × 5 foi 100; alterar o retorno pelo admin recalculou a coluna gerada.
- Navegador: 390 × 844, 430 × 932 e 1440 × 1000. Sem overflow horizontal nas telas verificadas; imagens carregaram; sem overlay de erro ou erros JavaScript registrados.
- Fluxo visual: projeto → modal → aceite → confirmação simulada → Meus painéis. Saldo real permaneceu zerado.
- Depósito de R$ 200 pela interface gerou solicitação simulada pendente.
- Filtro RJ retornou apenas Cota Solar Residencial; CE exibiu empty state.

## Limites da validação


WhatsApp depende de `NEXT_PUBLIC_WHATSAPP_GROUP_URL`. Recarga PIX real via SyncPay está habilitada; saques permanecem desativados. A demonstração é temporária, isolada e sem valor financeiro. PWA possui manifest/ícones, sem service worker offline. Textos legais são preliminares.

A prévia é local; não houve publicação pública. O projeto usa servidor Node.js/Next.js, não o runtime Workers exigido pelo Sites, e não foi convertido para outra stack.

## Arquivos criados

- `app/`: dashboard, projetos/detalhes, painéis/detalhes, carteira/depósito/saque, perfil/subpáginas, notificações, admin, autenticação, rotas API, metadata, manifest e estilos responsivos.
- Perfil: grade de atalhos, progresso da jornada e Central de metas educativas. Metas não oferecem bônus, rendimento ou prioridade.
- Admin: indicadores de usuários, depósitos confirmados, investidores pagos, total aplicado, saques pendentes e saídas; cronologia por tipo; auditoria de alterações em projetos.
- `lib/`: tipos, dados configuráveis, sessão de demonstração, repositório Supabase, validação Zod, rate limiting e adapter mock.
- `services/paymentGateway.ts`: contrato para o gateway futuro.
- `services/projects.ts`: chamadas de participação e depósito.
- `supabase/schema.sql` e `supabase/seed.sql`: nove tabelas, políticas RLS, privilégios, índices, trigger de cadastro e catálogo ilustrativo.
- `proxy.ts`: renovação de sessão Supabase.
- `public/`: logo, favicon e três imagens solares ilustrativas.
- `.env.example`, configurações Next/TypeScript/Tailwind/ESLint, package e lockfile.
- `README.md`, este relatório e `preview/`: instruções, limitações e capturas de tela.

Nenhum arquivo existente do usuário foi sobrescrito. Nenhuma senha compartilhada no chat foi gravada nos arquivos.

## Correção final para Vercel — 21/09/2026

- Removidos do pacote do app os arquivos `.ts` das Edge Functions Supabase; as funções continuam implantadas e ativas no Supabase.
- `tsconfig.json` passou a usar includes explícitos do Next (`app`, `components`, `lib`, `services`, `proxy.ts`, `next.config.ts`) e exclui `supabase/**`.
- `.vercelignore` ignora `supabase/functions/**`, `preview/**`, `tests/**` e este relatório.
- `tsc --showConfig` confirmou zero arquivos `supabase/functions` no conjunto compilado.
- 58 arquivos `.ts/.tsx` da aplicação foram analisados via TypeScript transpile e apresentaram zero erros de sintaxe.
- Varredura confirmou ausência das credenciais reais SyncPay nos arquivos do projeto.
- O build completo local não foi concluído porque o ambiente não conseguiu baixar todas as dependências do npm; no Vercel, a etapa de bundle já vinha compilando com sucesso e o bloqueio mostrado nos logs era exclusivamente o type-check das Edge Functions, agora removidas do pacote.


## Correção de cadastro — 22/09/2026

- Esta entrega parte da versão enviada pelo usuário (`Energy-invest-main.zip`).
- CAPTCHA removido do fluxo de autenticação.
- Cadastro não usa mais `auth.signUp` diretamente: `/api/auth` chama a Edge Function `register-user`, que cria e confirma o usuário no backend da Supabase e aciona o trigger de perfil/carteira.
- Após a criação, `/api/auth` faz login por e-mail/senha e grava a sessão via Supabase SSR.
- URL e publishable key da Supabase possuem fallback público no código (`lib/supabase/config.ts`), evitando falha no localhost/Vercel quando as variáveis públicas não foram configuradas.
- `proxy.ts`, cliente/browser, servidor, dados e geração de PIX usam a mesma configuração centralizada.
- `DEMO_MODE` agora só é ativado explicitamente com `DEMO_MODE=true`; ausência de env não força demonstração.
- Edge Function `register-user` está ACTIVE no projeto Supabase `rthagtoomnygcblugyxc`.
- Banco mantém trigger `create_energy_profile` para criar perfil, carteira e notificação após novo usuário.
- Varredura confirmou ausência das credenciais privadas SyncPay/Perfect Pay nos arquivos.
- Foi feita validação sintática global; nenhum diagnóstico de parsing TypeScript foi encontrado. O build completo não foi reexecutado neste ambiente porque as dependências npm não estão disponíveis em cache e o ambiente não possui acesso ao registry.

## Painéis, projeções e saques — 22/09/2026

- Catálogo real no Supabase atualizado para 12 painéis, com entrada mínima de R$ 50.
- Faixa internacional criada a partir de R$ 3.500, com projeção máxima de 3,0x no período.
- `return_multiplier` adicionado ao projeto e exibido no catálogo/detalhes.
- Compra debita a carteira e cria a participação com prazo contado a partir da compra.
- Projeção acumulada aparece no painel do usuário; saldo sacável só recebe distribuições efetivamente registradas do projeto.
- `publish_project_distribution` credita carteira, histórico, notificação e respeita o teto projetado do painel.
- Saque pode ser solicitado todos os dias entre 09h e 18h (America/Sao_Paulo), reservando o saldo imediatamente.
- Saques possuem fluxo `pending -> completed/cancelled`; cancelamento devolve o valor reservado.
- O envio PIX de saque não foi automatizado porque a documentação pública da SyncPay consultada expõe cash-in, mas não apresentou endpoint público de cash-out/payout.

## Correção catálogo Home — 22/09/2026
- Home deixou de limitar o catálogo a 3 projetos.
- Exibe 6 inicialmente e permite carregar mais em blocos de 6 até mostrar todos os projetos disponíveis.

## Programa de indicação — 22/09/2026
- Programa ativado no Supabase.
- Cada perfil possui código de convite único.
- Cadastro aceita `?ref=CODIGO` e preenche o convite automaticamente.
- Regra ativa: R$20 de bônus único para o indicador quando o convidado realiza a primeira compra elegível de pelo menos R$50.
- Bônus é registrado em `referral_rewards`, carteira, transações e notificações de forma idempotente por convidado.
- Perfil possui telas ativas de Convidar, Equipe e Recompensas.
- 12 imagens solares locais são distribuídas entre os 24 projetos para reduzir repetição visual.

## SyncPay — reconciliação de depósitos (22/09/2026)
- Webhook atualizado para aceitar `cashin.updated` (`id` na raiz) e `transaction.updated` (`transaction.reference_id`).
- Nova Edge Function `syncpay-reconcile` consulta a transação V2 e liquida somente status confirmado pela SyncPay.
- `depositStatus` chama a reconciliação antes de retornar o status ao front-end.
- Cron no Supabase reconcilia depósitos pendentes a cada minuto como fallback.
- Liquidação permanece idempotente via `settle_syncpay_deposit`: um depósito concluído não é creditado duas vezes.
