import { createHash } from 'crypto';

/**
 * CNPJ sintético (14 dígitos), único e determinístico por escopo de teste.
 * Prefixo 98 para não colidir com seeds/fixtures legados (00…, 88…, 99… fixos em specs antigas).
 */
export function cnpjE2e(scope: string): string {
  const key = `lexius.e2e:${scope.trim().toLowerCase()}`;
  const hex = createHash('sha256').update(key).digest('hex');
  let body = '';
  for (let i = 0; i < hex.length && body.length < 12; i += 2) {
    body += String(parseInt(hex.slice(i, i + 2), 16) % 10);
  }
  while (body.length < 12) body += '0';
  return `98${body}`;
}