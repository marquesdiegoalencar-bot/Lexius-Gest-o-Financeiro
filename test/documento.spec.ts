import { soDigitos, tipoPessoaPorDocumento } from '../src/common/utils/documento';

describe('documento', () => {
  it('soDigitos remove máscara', () => {
    expect(soDigitos('12.345.678/0001-99')).toBe('12345678000199');
  });

  it('tipo por documento', () => {
    expect(tipoPessoaPorDocumento('12345678901')).toBe('FISICA');
    expect(tipoPessoaPorDocumento('12345678000199')).toBe('JURIDICA');
  });
});