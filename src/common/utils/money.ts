export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toMoneyString(value: number): string {
  return roundMoney(value).toFixed(2);
}

export function fromMoney(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  return roundMoney(Number(value));
}

export function saldoTituloReceber(t: {
  valorOriginal: string;
  desconto: string;
  juros: string;
  multa: string;
  valorRecebido: string;
}): number {
  return roundMoney(
    fromMoney(t.valorOriginal) -
      fromMoney(t.desconto) +
      fromMoney(t.juros) +
      fromMoney(t.multa) -
      fromMoney(t.valorRecebido),
  );
}

export function saldoTituloPagar(t: {
  valorOriginal: string;
  desconto: string;
  juros: string;
  multa: string;
  valorPago: string;
}): number {
  return roundMoney(
    fromMoney(t.valorOriginal) -
      fromMoney(t.desconto) +
      fromMoney(t.juros) +
      fromMoney(t.multa) -
      fromMoney(t.valorPago),
  );
}