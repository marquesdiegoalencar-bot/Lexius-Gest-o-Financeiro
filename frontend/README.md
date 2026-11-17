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
- Variável `VITE_API_URL`: se vazia, o Vite faz proxy de `/v1` para `http://127.0.0.1:3000`

## Login de desenvolvimento

Use o seed da API (`master@lexius.local` / `Lexius@123`) com `npm run start:dev` na raiz.