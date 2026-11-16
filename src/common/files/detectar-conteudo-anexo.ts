import { fromBuffer } from 'file-type';

/** Extensão no disco a partir do MIME detectado pelo conteúdo (não usa nome do cliente). */
const EXTENSAO_POR_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

export const ANEXO_MIMES_PADRAO = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export type ConteudoAnexoDetectado = {
  mime: string;
  extensao: string;
};

export async function detectarConteudoAnexo(
  buffer: Buffer,
  allowedMime: Set<string>,
): Promise<ConteudoAnexoDetectado> {
  const detected = await fromBuffer(buffer);
  if (!detected?.mime) {
    throw new Error('UNRECOGNIZED');
  }
  if (!allowedMime.has(detected.mime)) {
    throw new Error('NOT_ALLOWED');
  }
  const extensao = EXTENSAO_POR_MIME[detected.mime];
  if (!extensao) {
    throw new Error('NOT_ALLOWED');
  }
  return { mime: detected.mime, extensao };
}