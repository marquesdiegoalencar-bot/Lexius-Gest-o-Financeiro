import { mascararParaLog } from '../src/common/utils/mascarar-dados';

describe('mascararParaLog', () => {
  it('oculta client_secret e bearer token', () => {
    const entrada =
      'client_secret=super-secreto&grant=1 Authorization: Bearer eyJhbGciOiJIUzI1';
    const saida = mascararParaLog(entrada);
    expect(saida).not.toContain('super-secreto');
    expect(saida).not.toContain('eyJhbGciOiJIUzI1');
    expect(saida).toContain('client_secret=***');
    expect(saida).toContain('Bearer ***');
  });
});