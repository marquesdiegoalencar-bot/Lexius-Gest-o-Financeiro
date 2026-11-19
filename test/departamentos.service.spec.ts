import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
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

  it('requireNome rejeita ausente, vazio e somente espaços', () => {
    const repo = buildRepo();
    const svc = new DepartamentosService(repo as never);
    expect(() => svc.requireNome(undefined)).toThrow(BadRequestException);
    expect(() => svc.requireNome(null)).toThrow(BadRequestException);
    expect(() => svc.requireNome('')).toThrow(BadRequestException);
    expect(() => svc.requireNome('   ')).toThrow(BadRequestException);
    expect(svc.requireNome('  RH  ')).toBe('RH');
  });

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

  it('create converte violação única PostgreSQL (23505) em ConflictException', async () => {
    const uniqueErr = new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('duplicate'), {
        code: '23505',
        constraint: 'uq_departamentos_empresa_codigo',
      }),
    );
    const repo = buildRepo({
      findOne: jest.fn(async () => null),
      save: jest.fn(async () => {
        throw uniqueErr;
      }),
    });
    const svc = new DepartamentosService(repo as never);
    await expect(svc.create(empresaId, { nome: 'Y', codigo: 'C1' })).rejects.toMatchObject({
      message: 'Código de departamento já em uso nesta empresa',
    });
  });
});