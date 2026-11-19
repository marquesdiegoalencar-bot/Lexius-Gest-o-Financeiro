import { ConflictException } from '@nestjs/common';
import { DepartamentosService } from '../src/modules/departamentos/departamentos.service';
import { Departamento } from '../src/database/entities/departamento.entity';

describe('DepartamentosService (unit)', () => {
  const empresaId = 'e1';

  function buildRepo(overrides?: Partial<Record<string, unknown>>) {
    const repo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: 'new-id' })),
      ...overrides,
    };
    return repo;
  }

  it('assertVinculoFinanceiroFuturo rejeita departamento inativo', async () => {
    const repo = buildRepo({
      findOne: jest.fn(async () => ({ id: 'd1', empresaId, ativo: false })),
    });
    const svc = new DepartamentosService(repo as never);
    await expect(svc.assertVinculoFinanceiroFuturo(empresaId, 'd1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('create rejeita código duplicado na mesma empresa', async () => {
    const repo = buildRepo({
      findOne: jest.fn(async ({ where }: { where: { codigo?: string } }) =>
        where.codigo ? ({ id: 'outro' } as Departamento) : null,
      ),
    });
    const svc = new DepartamentosService(repo as never);
    await expect(
      svc.create(empresaId, { nome: 'X', codigo: 'DUP' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});