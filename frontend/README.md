# Lexius Financeiro — Frontend

SPA independente (React + Vite + TypeScript + Tailwind + componentes no estilo shadcn/ui + Lucide).

## Scripts

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

Na raiz do monorepo:

```bash
npm run frontend:dev
npm run frontend:build
```

## API

- Prefixo NestJS: `/v1`
- Autenticação: `POST /v1/auth/login` → JWT + header `X-Empresa-Id`
- Variável `VITE_API_URL`: se vazia, o Vite faz proxy de `/v1` para `http://127.0.0.1:3000` (dev e preview)
- Se definir `VITE_API_URL`, use só o host, ex.: `http://localhost:3000` (não coloque `/v1` no final)

## Recuperação de senha

- `POST /v1/auth/esqueci-senha` e `POST /v1/auth/redefinir-senha` (API atualizada + migração `009`)
- UI: `/login/esqueci-senha`

Se aparecer **Cannot POST /v1/auth/esqueci-senha**, a requisição não chegou na API nova: reinicie o Nest (`npm run build` + `npm run start:dev`), rode `npm run db:migrate`, e evite `VITE_API_URL` apontando para outro host desatualizado.

## Login de desenvolvimento

Use o seed da API (`master@lexius.local` / `Lexius@123`) com `npm run start:dev` na raiz.