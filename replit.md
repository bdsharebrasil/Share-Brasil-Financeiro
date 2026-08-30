# Share Brasil

Sistema interno da Share Brasil para operação aeronáutica, financeiro, gestão e acompanhamento de cotistas.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/share-brasil` — aplicação web principal, shell dos dashboards e páginas de financeiro, cotistas, operações e configurações.
- `artifacts/api-server` — API Express em `/api`, com os endpoints de resumo por departamento, movimentações e cotistas.
- `lib/api-spec/openapi.yaml` — contrato fonte da API; os hooks e schemas são gerados por Orval.
- `lib/api-client-react` e `lib/api-zod` — cliente React Query e validações geradas.
- `attached_assets` — referências visuais, logotipos, categorias de movimentação e relatórios de centro de custo.

## Architecture decisions

- O produto usa uma navegação superior para alternar entre Operações, Financeiro, Gestor e Portal Cliente, mantendo o contexto da área visível.
- Caixa Share e Caixa Cliente são superfícies separadas; lançamentos reembolsáveis permanecem identificados para posterior rateio entre cotistas.
- O primeiro corte usa contratos tipados e uma camada de dados demonstrativa na API para validar a experiência antes de ligar as tabelas legadas/D1.
- A interface oferece dark/light mode persistido e usa a linguagem visual Share Brasil como referência de densidade e leitura operacional.

## Product

- Dashboard Gestor com saldo consolidado, fechamentos mensais, alertas e atalhos para agenda, lançamentos, cotistas e relatórios.
- Dashboard de Operações com voos, agenda, plano de voo, diário de bordo, tripulação, abastecimentos e CTM.
- Dashboard Financeiro com lançamentos filtráveis, pendências, cobranças e programação de pagamentos.
- Acompanhamento de cotistas por aeronave, horas, utilização, saldo e status do fechamento.
- Configurações para preferências financeiras e futuras integrações de fornecedores, contas e categorias.

## User preferences

- Toda a interface e nomenclatura do domínio devem ser em português.
- O sistema precisa ter opção de tema dark e light.
- O login existente deve continuar sendo mantido pelo Supabase durante a migração gradual dos dados.

## Gotchas

- Não misturar Caixa Share com Caixa Cliente nos cálculos ou na apresentação.
- `tipo_caixa` representa o caixa que movimentou o dinheiro naquele momento; não substitui a classificação da despesa nem o registro de rateio.
- Toda mudança no contrato da API deve partir de `lib/api-spec/openapi.yaml` e ser seguida de `pnpm --filter @workspace/api-spec run codegen`.
- Os serviços devem ser reiniciados pelas workflows gerenciadas do artefato para manter o roteamento por `/api` e `/`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
