/** Remove client_secret, tokens e certificados de strings antes de logar. */
export function mascararParaLog(texto: string): string {
  return texto
    .replace(/client_secret=[^&\s"']+/gi, 'client_secret=***')
    .replace(/("client_secret"\s*:\s*)"[^"]*"/gi, '$1"***"')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***')
    .replace(/("access_token"\s*:\s*)"[^"]*"/gi, '$1"***"')
    .replace(/-----BEGIN[^-]+-----[\s\S]*?-----END[^-]+-----/g, '-----CERTIFICADO***-----');
}

export function mascararRefCredencial(ref: string): string {
  if (ref.length <= 4) return '****';
  return `${ref.slice(0, 2)}***${ref.slice(-2)}`;
}