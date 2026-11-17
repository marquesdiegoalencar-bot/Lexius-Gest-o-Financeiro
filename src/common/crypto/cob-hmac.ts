import { createHmac, timingSafeEqual } from 'crypto';

/** Assinatura v2: HMAC-SHA256(secret, `${timestamp}.${rawBody}`) */
export function cobAssinarMensagem(secret: string, timestampUnix: string, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestampUnix}.${rawBody}`).digest('hex');
}

/** Legado: apenas o corpo (compatível com integrações sem X-Timestamp). */
export function cobAssinarCorpoLegado(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function cobVerificarAssinatura(params: {
  secret: string;
  rawBody: string;
  assinatura: string;
  timestampHeader?: string | null;
  maxSkewSec?: number;
  agoraUnix?: number;
}): { ok: true; modo: 'v2' | 'legado' } | { ok: false; motivo: string } {
  const maxSkew = params.maxSkewSec ?? 300;
  const agora = params.agoraUnix ?? Math.floor(Date.now() / 1000);

  if (params.timestampHeader?.trim()) {
    const ts = Number(params.timestampHeader);
    if (!Number.isFinite(ts)) {
      return { ok: false, motivo: 'X-Timestamp inválido' };
    }
    if (Math.abs(agora - ts) > maxSkew) {
      return { ok: false, motivo: 'X-Timestamp fora da janela de 5 minutos' };
    }
    const esperada = cobAssinarMensagem(params.secret, String(Math.trunc(ts)), params.rawBody);
    return buffersIguais(params.assinatura, esperada)
      ? { ok: true, modo: 'v2' }
      : { ok: false, motivo: 'Assinatura HMAC inválida' };
  }

  const esperadaLegado = cobAssinarCorpoLegado(params.secret, params.rawBody);
  return buffersIguais(params.assinatura, esperadaLegado)
    ? { ok: true, modo: 'legado' }
    : { ok: false, motivo: 'Assinatura HMAC inválida' };
}

function buffersIguais(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}