import { calcularItemRepasse } from '../src/common/financeiro/repasse-calculo';

describe('repasse-calculo', () => {
  it('referência: bruto 100, tarifa 0,90, comissão 10% => repasse 89,10', () => {
    const item = calcularItemRepasse({
      baixa: { valorLiquido: '99.10', tarifa: '0.90' },
      percentualComissao: 10,
    });
    expect(item.valorRecebidoBruto).toBe(100);
    expect(item.comissao).toBe(10);
    expect(item.tarifa).toBe(0.9);
    expect(item.valorRepasse).toBe(89.1);
  });
});