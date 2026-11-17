import { createHash } from 'crypto';

export type WebhookPixParse =
  | { ok: true; txid: string; eventoIdExterno: string }
  | { ok: false; eventoIdExterno: string; motivo: string };

/** Mapper mínimo de callback Pix (cob/cobv). Payload completo pendente de exemplo real. */
export function parseWebhookCallbackPix(payload: Record<string, unknown>): WebhookPixParse {
  const txid =
    (payload.txid as string | undefined) ??
    (payload.txId as string | undefined) ??
    ((payload.pix as Array<Record<string, unknown>> | undefined)?.[0]?.txid as string | undefined);

  if (!txid?.trim()) {
    const eventoIdExterno = `hash-${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
    return { ok: false, eventoIdExterno, motivo: 'MAPEAMENTO_PIX_SEM_TXID' };
  }

  const endToEnd =
    (payload.endToEndId as string | undefined) ??
    ((payload.pix as Array<Record<string, unknown>> | undefined)?.[0]?.endToEndId as string | undefined);

  const eventoIdExterno =
    endToEnd?.trim() ||
    `${txid}-${String(payload.horario ?? payload.timestamp ?? '')}`.slice(0, 180) ||
    `tx-${txid}`;

  return { ok: true, txid: txid.trim(), eventoIdExterno };
}