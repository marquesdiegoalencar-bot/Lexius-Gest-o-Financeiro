import { NotImplementedException } from '@nestjs/common';

export function provedorFase3BPendente(metodo: string): never {
  throw new NotImplementedException(`${metodo} disponível na Fase 3B/3C`);
}