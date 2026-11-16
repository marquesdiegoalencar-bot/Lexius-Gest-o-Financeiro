export function soDigitos(valor: string | undefined | null): string | null {
  if (!valor) return null;
  const d = valor.replace(/\D/g, '');
  return d.length ? d : null;
}

export function tipoPessoaPorDocumento(documento: string | null): 'FISICA' | 'JURIDICA' {
  if (!documento) return 'FISICA';
  return documento.length > 11 ? 'JURIDICA' : 'FISICA';
}