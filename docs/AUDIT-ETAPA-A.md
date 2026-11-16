# npm audit — Etapa A

## Antes (Nest 10 + bcrypt)

| Severidade | Quantidade |
|------------|------------|
| critical | 1 |
| high | 11 |
| moderate | 14 |
| low | 11 |
| **total** | **37** |

Principais em **produção**: `tar`/`bcrypt`, `body-parser`, `multer`, `lodash`, `glob` (via typeorm).

## Depois (Nest 11.1 + bcryptjs + typeorm 0.3.28)

| Severidade | Quantidade |
|------------|------------|
| critical | **0** |
| high | **0** |
| moderate | 4 |
| low | 8 |
| **total** | **12** |

Restantes ligados a **dev** (`@nestjs/cli`, `jest`, `deepmerge`) e **moderate** transitivo em `typeorm` → `glob`/`minimatch` (sem advisory high/critical na árvore de `dependencies`).

## Meta produção

**0 critical, 0 high** em `dependencies` — atingida após remoção do `bcrypt` nativo e upgrade Nest/platform.