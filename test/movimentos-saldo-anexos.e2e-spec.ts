import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { FormaPagamento } from '../src/database/enums';
import {
  authHeaders,
  criarContaBancaria,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  getCategoriaGlobal,
  login,
  posicaoEmpresa,
  saldoSistemaConta,
  somaSaldoContasEmpresa,
} from './e2e-auth.helpers';

describe('movimentos bancários, saldo e estorno (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaId: string;
  let catReceita: string;
  let catDespesa: string;
  let contaId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    ({ token, empresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    catReceita = await getCategoriaGlobal(dataSource, '1.01');
    catDespesa = await getCategoriaGlobal(dataSource, '2.01');
    contaId = await criarContaBancaria(app, token, empresaId);
  });

  afterAll(async () => {
    await app.close();
  });

  async function movimentosDaBaixa(baixaId: string) {
    return dataSource.query(
      `SELECT sentido, valor::float AS valor, tipo_transacao, id_externo
       FROM movimentos_bancarios
       WHERE id_externo LIKE $1
       ORDER BY tipo_transacao`,
      [`baixa-${baixaId}-%`],
    );
  }

  it('baixa a receber gera movimento principal e tarifa separados', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR movimentos',
        categoria_id: catReceita,
        valor_original: 500,
        data_vencimento: '2026-12-01',
      });
    const tituloId = criar.body.id;

    const baixa = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/baixar`)
      .set(authHeaders(token, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-11-20',
        valor_principal: 200,
        tarifa: 7.5,
        forma: FormaPagamento.PIX,
      });
    expect(baixa.status).toBe(201);
    const baixaId = baixa.body.baixa.id as string;
    expect(Number(baixa.body.baixa.valorLiquido)).toBe(192.5);

    const movs = await movimentosDaBaixa(baixaId);
    expect(movs).toHaveLength(2);
    const principal = movs.find((m: { tipo_transacao: string }) => m.tipo_transacao === 'BAIXA');
    const tarifa = movs.find((m: { tipo_transacao: string }) => m.tipo_transacao === 'TARIFA');
    expect(principal.sentido).toBe('CREDITO');
    expect(principal.valor).toBe(200);
    expect(tarifa.sentido).toBe('DEBITO');
    expect(tarifa.valor).toBe(7.5);
  });

  it('baixa a pagar gera débito principal e débito de tarifa', async () => {
    const saldoAntes = await saldoSistemaConta(dataSource, contaId);
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-pagar')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TP movimentos',
        categoria_id: catDespesa,
        valor_original: 100,
        data_vencimento: '2026-12-05',
      });
    const tituloId = criar.body.id;
    await request(app.getHttpServer())
      .post(`/v1/titulos-pagar/${tituloId}/aprovar`)
      .set(authHeaders(token, empresaId));

    const baixa = await request(app.getHttpServer())
      .post(`/v1/titulos-pagar/${tituloId}/baixar`)
      .set(authHeaders(token, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-11-21',
        valor_principal: 100,
        tarifa: 4,
        forma: FormaPagamento.PIX,
      });
    expect(baixa.status).toBe(201);
    const baixaId = baixa.body.baixa.id as string;
    const movs = await movimentosDaBaixa(baixaId);
    expect(movs).toHaveLength(2);
    expect(movs.every((m: { sentido: string }) => m.sentido === 'DEBITO')).toBe(true);
    expect(movs.map((m: { valor: number }) => m.valor).sort((a: number, b: number) => a - b)).toEqual([
      4, 100,
    ]);

    const saldoDepois = await saldoSistemaConta(dataSource, contaId);
    expect(saldoDepois).toBeCloseTo(saldoAntes - 104, 2);
  });

  it('parcial, total, estorno atualizam v_saldo_conta e v_posicao_empresa', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR saldo views',
        categoria_id: catReceita,
        valor_original: 300,
        data_vencimento: '2026-12-15',
        conta_bancaria_id: contaId,
      });
    const tituloId = criar.body.id;

    let saldo = await saldoSistemaConta(dataSource, contaId);
  let pos = await posicaoEmpresa(dataSource, empresaId);

    const parcial = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/baixar`)
      .set(authHeaders(token, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-11-22',
        valor_principal: 100,
        tarifa: 2,
        forma: FormaPagamento.PIX,
      });
    expect(parcial.body.titulo.status).toBe('PARCIAL');
    const saldoAposParcial = await saldoSistemaConta(dataSource, contaId);
    expect(saldoAposParcial).toBeCloseTo(saldo + 98, 2);
    pos = await posicaoEmpresa(dataSource, empresaId);
    const somaContas = await somaSaldoContasEmpresa(dataSource, empresaId);
    expect(pos.saldoTotal).toBeCloseTo(somaContas, 2);
    expect(pos.saldoProprio).toBeCloseTo(somaContas - pos.aRepassar, 2);
    saldo = saldoAposParcial;

    const total = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/baixar`)
      .set(authHeaders(token, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-11-23',
        valor_principal: 205,
        tarifa: 3,
        forma: FormaPagamento.PIX,
      });
    expect(total.body.titulo.status).toBe('PAGO');
    const saldoAposTotal = await saldoSistemaConta(dataSource, contaId);
    expect(saldoAposTotal).toBeCloseTo(saldo + 202, 2);
    const baixaTotalId = total.body.baixa.id as string;

    const estorno = await request(app.getHttpServer())
      .post(`/v1/baixas/${baixaTotalId}/estornar`)
      .set(authHeaders(token, empresaId))
      .send({ motivo: 'correção de valor' });
    expect(estorno.status).toBe(201);

    const titulo = await dataSource.query(`SELECT status, valor_recebido::float FROM titulos_receber WHERE id = $1`, [
      tituloId,
    ]);
    expect(titulo[0].status).toBe('PARCIAL');
    expect(titulo[0].valor_recebido).toBeCloseTo(98, 2);

    const saldoAposEstorno = await saldoSistemaConta(dataSource, contaId);
    expect(saldoAposEstorno).toBeCloseTo(saldoAposParcial, 2);

    const estornos = await dataSource.query(
      `SELECT count(*)::int AS n FROM movimentos_bancarios WHERE id_externo LIKE $1`,
      [`estorno-${baixaTotalId}-%`],
    );
    expect(estornos[0].n).toBe(2);

    pos = await posicaoEmpresa(dataSource, empresaId);
    const somaContasFim = await somaSaldoContasEmpresa(dataSource, empresaId);
    expect(pos.saldoTotal).toBeCloseTo(somaContasFim, 2);
    expect(pos.saldoProprio).toBeCloseTo(somaContasFim - pos.aRepassar, 2);
  });
});

describe('anexos validação (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let empresaId: string;
  let tituloId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    const dataSource = moduleFixture.get(DataSource);
    ({ token, empresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    const categoriaId = await getCategoriaGlobal(dataSource, '1.01');
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR anexo validação',
        categoria_id: categoriaId,
        valor_original: 50,
        data_vencimento: '2026-12-01',
      });
    tituloId = criar.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejeita nome com caminho (../)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/anexos')
      .query({ entidade: 'titulo_receber', entidade_id: tituloId })
      .set(authHeaders(token, empresaId))
      .attach('file', Buffer.from('%PDF-1.4'), {
        filepath: '../../malicioso.pdf',
        contentType: 'application/pdf',
      } as { filename?: string; contentType?: string; filepath?: string });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/arquivo inválido/i);
  });

  it('rejeita arquivo acima do limite configurado', async () => {
    const grande = Buffer.alloc(11 * 1024 * 1024, 1);
    const res = await request(app.getHttpServer())
      .post('/v1/anexos')
      .query({ entidade: 'titulo_receber', entidade_id: tituloId })
      .set(authHeaders(token, empresaId))
      .attach('file', grande, {
        filename: 'grande.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tamanho/i);
  });
});