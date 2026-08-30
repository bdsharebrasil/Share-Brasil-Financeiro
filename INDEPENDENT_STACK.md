# Arquitetura independente

O backend agora é um **Cloudflare Worker** em `apps/worker`, com persistência em **Cloudflare D1** e autenticação delegada ao **Supabase Auth**. O frontend React envia o access token Supabase em `Authorization: Bearer <token>` e o Worker valida esse token pelo endpoint `/auth/v1/user` antes de acessar dados do usuário.

## Configuração do frontend

Crie `artifacts/share-brasil/.env.local`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
VITE_API_URL=https://share-brasil-api.SUA_CONTA.workers.dev
```

A chave `anon` é apropriada para o cliente quando as regras de autorização são aplicadas no backend. Nunca coloque `service_role` no frontend ou no Worker.

## Criar e configurar o D1

Na conta Cloudflare:

```bash
npx wrangler d1 create share-brasil
```

Copie o `database_id` retornado para `apps/worker/wrangler.toml` no lugar de `REPLACE_WITH_D1_DATABASE_ID`. Depois aplique a migração:

```bash
pnpm --filter @share-brasil/worker db:remote
```

Para desenvolvimento local:

```bash
pnpm --filter @share-brasil/worker db:local
pnpm --filter @share-brasil/worker dev
```

## Segredos do Worker

Defina as variáveis não públicas diretamente no Cloudflare:

```bash
cd apps/worker
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put ALLOWED_ORIGIN
```

`ALLOWED_ORIGIN` deve ser a origem exata do frontend em produção, por exemplo `https://app.seudominio.com`. Em desenvolvimento, o Worker aceita a origem informada pelo navegador quando esse segredo não é definido.

## Endpoints

| Endpoint | Autenticação | Fonte |
| --- | --- | --- |
| `GET /api/healthz` | Pública | Worker |
| `GET /api/dashboard/summary?departamento=...` | Bearer Supabase | D1, filtrado por `user_id` |
| `GET /api/financeiro/movimentacoes?caixa=...&limite=...` | Bearer Supabase | D1, filtrado por `user_id` |
| `GET /api/financeiro/cotistas` | Bearer Supabase | D1, filtrado por `user_id` |

O servidor Express, os plugins de desenvolvimento e os SDKs específicos do Replit foram removidos. O projeto não depende mais de runtime, proxy ou API hospedada pelo Replit.
