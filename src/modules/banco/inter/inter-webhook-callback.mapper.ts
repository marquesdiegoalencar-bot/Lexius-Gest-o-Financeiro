import { createHash } from 'crypto';

export type WebhookCallbackParse =
  | { ok: true; codigoSolicitacao: string; eventoIdExterno: string; gatilhoVerificacao: boolean }
  | { ok: false; eventoIdExterno: string; motivo: string };

/**
 * Mapper parcial do callback de cobrança (Inter).
 * Payload completo pendente de exemplo real do cliente — aceitamos só chaves documentadas/adotadas.
 */
export function parseWebhookCallbackCobranca(payload: Record<string, unknown>): WebhookCallbackParse {
  const codigo =
    (payload.codigoSolicitacao as string | undefined) ??
    (payload.codigoSolicitacaoCobranca as string | undefined) ??
    ((payload.cobranca as Record<string, unknown> | undefined)?.codigoSolicitacao as string | undefined);

  const eventoId =
    (payload.codigoTransacao as string | undefined) ??
    (payload.endToEndId as string | undefined);

  if (!codigo?.trim()) {
    const eventoIdExterno = `hash-${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
    return { ok: false, eventoIdExterno, motivo: 'MAPEAMENTO_PENDENTE_SEM_CODIGO' };
  }

  const eventoIdExterno =
    eventoId?.trim() ||
    `${codigo}-${String(payload.dataHoraSituacao ?? payload.timestamp ?? '')}`.slice(0, 180) ||
    `cs-${codigo}`;

  return {
    ok: true,
    codigoSolicitacao: codigo,
    eventoIdExterno,
    gatilhoVerificacao: true,
  };
}