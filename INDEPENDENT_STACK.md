# Stack independente — Share Brasil

O backend da Share Brasil é um **Cloudflare Worker** em `apps/worker`, com persistência no banco **Cloudflare D1** `bd_sharebrasil`. O Worker possui dois contextos de autenticação separados: o Portal Cliente usa uma sessão própria assinada pelo Worker, enquanto o Sistema Interno Share Brasil continua usando o access token do Supabase para os usuários internos.

## Banco D1 existente

O `wrangler.toml` já está vinculado ao banco D1 `bd_sharebrasil`. As tabelas de negócio migradas incluem `cliente`, `aeronave`, `empresa`, `solicitacoes_reserva_voo`, `tripulacao`, `tripulacao_freelancer`, `user_cliente`, `user_profiles` e as demais tabelas auxiliares do sistema.

A migração incremental `apps/worker/migrations/0002_portal_reservas.sql` adiciona `empresa.telegram_chat_id`, índices para login e reservas e a tabela `voo_sequencia`, que mantém a sequência usada na geração do número rastreável de voo.

Para aplicar as migrações remotamente:

```bash
cd /home/ubuntu/Share-Brasil-Financeiro
pnpm --filter @share-brasil/worker db:remote
```

A migração deve ser aplicada uma única vez no banco remoto. Antes de usar o envio de solicitações, preencha `empresa.telegram_chat_id` com o chat ID ou username aceito pela Bot API do Telegram.

## Secrets do Worker

Defina os secrets diretamente no Cloudflare, sem colocá-los no frontend:

```bash
cd apps/worker
npx wrangler secret put CLIENT_SESSION_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put ALLOWED_ORIGIN
```

`CLIENT_SESSION_SECRET` assina as sessões do Portal Cliente e deve ser um valor aleatório longo. `TELEGRAM_BOT_TOKEN` pertence ao bot responsável por enviar as solicitações à coordenação. `SUPABASE_URL` e `SUPABASE_ANON_KEY` são utilizados somente para validar o login dos usuários internos. `ALLOWED_ORIGIN` deve ser a origem exata do frontend em produção.

## Segurança de `user_cliente`

Os valores antigos de `user_cliente.senha` podem estar em texto simples. O endpoint interno `POST /api/interno/seguranca/migrar-senhas` converte esses valores para o formato:

```text
pbkdf2_sha256$210000$<salt>$<hash>
```

A operação exige um Bearer Token válido do Supabase e deve ser executada uma vez após a migração do banco. Como proteção adicional, o login também converte automaticamente a senha legada do usuário que entrar pela primeira vez. Depois de confirmar que todos os usuários foram migrados, o endpoint não terá mais trabalho a executar.

## Fluxo Portal Cliente

O cliente faz `POST /api/portal/login` com `login` e `senha`. O Worker consulta `user_cliente`, verifica o hash PBKDF2 e devolve uma sessão assinada. O cliente autenticado pode consultar `GET /api/portal/me`, `GET /api/portal/disponibilidade?de=YYYY-MM-DD&ate=YYYY-MM-DD` e `GET /api/portal/solicitacoes`.

Para criar uma solicitação, o Portal envia `POST /api/portal/solicitacoes` com `aeronave_id`, `origem`, `destino`, `data_agendada`, `horario_previsto_agendamento`, `dias_duracao`, `numero_passageiros`, `voo_emprestado` e `observacoes`. A solicitação é gravada com status `pendente`, e o Worker envia os detalhes para o `telegram_chat_id` da empresa. O Portal recebe apenas a confirmação de que a solicitação foi enviada para análise.

## Fluxo Sistema Interno Share Brasil

O sistema interno usa `Authorization: Bearer <token_supabase>` para os endpoints internos. A coordenação consulta `GET /api/interno/solicitacoes?status=pendente`. Para aprovar, envia `POST /api/interno/solicitacoes/:id/aprovar` com `piloto_id` e, opcionalmente, `copiloto_id`. O Worker valida que comandante e copiloto estão ativos em `tripulacao` ou `tripulacao_freelancer`, gera um número no formato `<codigo_cliente>-0001` e grava `numero_voo` na solicitação.

Para reprovar, envia `POST /api/interno/solicitacoes/:id/reprovar` com `motivo_rejeicao`. A aprovação e a reprovação não são executadas pelo Portal Cliente. O coordenador pode então comunicar manualmente ao cliente a confirmação do voo, usando o número gerado como identificador de rastreamento para abastecimento, despesas, peso e balanceamento, diário de bordo e demais etapas futuras.

## Endpoints principais

| Endpoint | Autenticação | Finalidade |
| --- | --- | --- |
| `GET /api/healthz` | Pública | Verifica se o Worker e o binding D1 estão disponíveis. |
| `POST /api/portal/login` | Pública | Login próprio do cliente e criação de sessão assinada. |
| `GET /api/portal/me` | Sessão do cliente | Retorna o usuário cliente autenticado. |
| `GET /api/portal/disponibilidade` | Sessão do cliente | Retorna aeronaves ativas e reservas do período. |
| `GET /api/portal/solicitacoes` | Sessão do cliente | Lista solicitações do cliente vinculado. |
| `POST /api/portal/solicitacoes` | Sessão do cliente | Cria a solicitação e notifica a coordenação via Telegram. |
| `POST /api/interno/seguranca/migrar-senhas` | Bearer Supabase | Converte senhas legadas em hashes PBKDF2. |
| `GET /api/interno/solicitacoes` | Bearer Supabase | Lista solicitações para a operação interna. |
| `POST /api/interno/solicitacoes/:id/aprovar` | Bearer Supabase | Escala tripulação e gera `numero_voo`. |
| `POST /api/interno/solicitacoes/:id/reprovar` | Bearer Supabase | Registra o motivo da reprovação. |

O frontend interno continua configurado com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_API_URL`. O Portal Cliente não precisa utilizar o SDK Supabase para autenticação; ele deve guardar o token retornado pelo login próprio e enviá-lo como Bearer Token nas chamadas protegidas.
