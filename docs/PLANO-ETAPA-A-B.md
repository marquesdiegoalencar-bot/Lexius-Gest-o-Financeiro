# Plano — Etapa A (segurança) e Etapa B (Fase 2)

Fonte: `ESPECIFICACAO.md` + `schema.sql` (banco). Mudanças de schema só via `migrations/` (deltas pequenos e justificados).

## Etapa A — Segurança (PR separado)

| Item | Ação |
|------|------|
| Senha | `bcrypt` → **bcryptjs** (sem native `tar`) |
| Runtime | NestJS **12.x**, `@nestjs/*` alinhados, **typeorm** recente, **uuid** ≥ 11.1.1 |
| Dev | `@nestjs/cli` 12.x (não entra em produção) |
| Validação | `npm audit` antes/depois; meta **0 critical / 0 high em produção** |
| Testes | `build`, `test`, `test:e2e` + CI verde |

## Etapa B — Fase 2 sem banco (PR separado, base na A)

### Estrutura de pastas (incremental)

```
migrations/
  001_...sql          # deltas (ex.: aprovação título a pagar)
schema.sql            # atualizado espelhando migrations acumuladas

src/
  common/
    auditoria/        # AuditoriaService + decorator/interceptor
    storage/          # StorageProvider (LocalDisk; S3 futuro)
    financeiro/       # helpers status título, parcelas, recorrência
  modules/
    titulos-receber/  # CRUD, parcelamento, cancelamento, filtros
    titulos-pagar/    # CRUD, parcelado, recorrência, aprovar (MASTER)
    baixas/           # baixa manual TR/TP, parcial/total, estorno MASTER
    recorrencias/     # cadastro + job/endpoint gerar títulos
    anexos/           # multipart, limites, download URL temporária
    intergrupo/       # POST espelhado §2.7
    relatorios/       # a receber/pagar período + vencidos
```

### Schema (deltas mínimos previstos)

- `titulos_pagar`: `status_aprovacao` (`PENDENTE` \| `APROVADO` \| `REJEITADO`), `aprovado_por`, `aprovado_em`, `rejeitado_motivo` (fluxo lançar → aprovar → baixa manual).
- Demais tabelas já cobrem `baixas`, `recorrencias`, `operacoes_intergrupo`, `anexos`, `auditoria`, `movimentos_bancarios` (baixa manual cria movimento `MANUAL`).

### Endpoints principais (`/v1`)

| Área | Rotas |
|------|--------|
| Receber | `GET/POST /titulos-receber`, `POST .../parcelar`, `PATCH .../cancelar`, `GET ?filtros` |
| Pagar | `GET/POST /titulos-pagar`, `POST .../:id/aprovar` (MASTER), `POST .../:id/rejeitar` |
| Baixas | `POST /titulos-receber/:id/baixar`, `POST /titulos-pagar/:id/baixar` (MASTER se aprovado), `POST /baixas/:id/estornar` (MASTER) |
| Recorrência | `GET/POST /recorrencias`, `POST /recorrencias/:id/gerar` |
| Anexos | `POST /anexos`, `GET /anexos/:id/download?token=` |
| Intergrupo | `POST /intergrupo`, `GET /intergrupo`, `POST .../cancelar` (MASTER pós-baixa) |
| Relatórios | `GET /relatorios/titulos-receber`, `.../titulos-pagar`, `.../vencidos` |

### E2e (por fluxo)

1. TR manual + parcelamento + baixa parcial + baixa total + cancelamento + filtros  
2. TP manual + aprovação MASTER + baixa; não-MASTER bloqueado  
3. Estorno baixa (MASTER) + auditoria persistida  
4. Anexo upload/download + limite tamanho/tipo  
5. Intergrupo cria par TR/TP atômico  
6. Relatórios período/vencidos  
7. Regressão: integração COB + auth  

### Fora de escopo (Fase 2)

- Provedores bancários, webhooks, API pagamento, emissão boleto, conciliação automática, repasses, front-end.