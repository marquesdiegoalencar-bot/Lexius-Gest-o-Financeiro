import { createHash } from 'crypto';

/** txid Pix: 26–35 caracteres alfanuméricos [a-zA-Z0-9]. */
export function gerarTxidCobv(tituloId: string, sufixo = ''): string {
  const hash = createHash('sha256')
    .update(`${tituloId}:${sufixo}`)
    .digest('hex')
    .replace(/[^a-zA-Z0-9]/g, 'a');
  const base = `lx${hash}`;
  return base.slice(0, 35).length >= 26 ? base.slice(0, 35) : base.padEnd(26, '0');
}