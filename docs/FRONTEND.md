# Frontend Lexius Financeiro

## Estrutura do repositório

| Caminho | Papel |
|---------|--------|
| `/` | API NestJS 11, TypeORM, PostgreSQL (inalterada) |
| `/frontend` | SPA React independente |

## Stack

- Vite 8, React 19, TypeScript
- Tailwind CSS 4 (`@tailwindcss/vite`)
- Componentes UI no padrão **shadcn/ui** (Button, Card, Input, Badge, …)
- **Lucide** para ícones
- **React Router** 7
- **Recharts** no dashboard

## Layout

Menu lateral azul (referência visual Lexius COB), cabeçalho com usuário/empresa, área principal.

## Rotas

| Rota | Tela |
|------|------|
| `/login` | Autenticação JWT |
| `/` | Dashboard (indicadores + gráfico + movimentações) |
| `/contas-a-receber` … `/relatorios` | Shell preparado para CRUD |

## Integração

Cliente em `frontend/src/lib/api.ts` e hook `useApi()`. JWT e `X-Empresa-Id` vêm do `AuthProvider`.

## Desenvolvimento

1. Subir API: `npm run start:dev` na raiz (porta 3000).
2. Subir UI: `npm run frontend:dev` ou `cd frontend && npm run dev`.
3. Opcional: `VITE_API_URL=http://localhost:3000/v1` se não usar proxy.