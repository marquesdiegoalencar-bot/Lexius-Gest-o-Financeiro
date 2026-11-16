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

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type ConteudoAnexoDetectado = {
  mime: string;
  extensao: string;
};

function pareceZip(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  );
}

function detectarMimePorMagicBytes(buffer: Buffer): string | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }
  if (buffer.length >= PNG_SIG.length && buffer.subarray(0, PNG_SIG.length).equals(PNG_SIG)) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (pareceXlsx(buffer)) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  return null;
}

/** XLSX é ZIP OOXML: PK + marcadores internos (sem parser genérico de ZIP/ASF). */
function pareceXlsx(buffer: Buffer): boolean {
  if (!pareceZip(buffer)) {
    return false;
  }
  const scanEnd = Math.min(buffer.length, 512 * 1024);
  const blob = buffer.subarray(0, scanEnd).toString('latin1');
  if (blob.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
    return true;
  }
  return blob.includes('xl/workbook.xml') || blob.includes('xl/worksheets/');
}

export function detectarConteudoAnexo(
  buffer: Buffer,
  allowedMime: Set<string>,
): ConteudoAnexoDetectado {
  const mime = detectarMimePorMagicBytes(buffer);
  if (!mime) {
    throw new Error('UNRECOGNIZED');
  }
  if (!allowedMime.has(mime)) {
    throw new Error('NOT_ALLOWED');
  }
  const extensao = EXTENSAO_POR_MIME[mime];
  if (!extensao) {
    throw new Error('NOT_ALLOWED');
  }
  return { mime, extensao };
}