import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { InterPixCobvHttpService } from '../src/modules/banco/inter/inter-pix-cobv-http.service';
import { CobrancaJobsService } from '../src/modules/cobrancas/cobranca-jobs.service';
import { buildAcordoExemploSpec, E2E_COB_API_KEY, signCobBody } from './cob-integracao.helpers';

describe('Emissão cobv em lote — falhas e job de reemissão (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const codigo = `ACE_LOTE_FAIL_${Date.now()}`;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('registra pendentes no meio do lote e job reemite sem duplicar', async () => {
    const pix = app.get(InterPixCobvHttpService);
    pix.simularFalhasEmissaoMock(2);

    const body = JSON.stringify(buildAcordoExemploSpec(codigo));
    const res = await request(app.getHttpServer())
      .post('/v1/integracao/cobranca/acordos')
      .set('Content-Type', 'application/json')
      .set('X-Api-Key', E2E_COB_API_KEY)
      .set('X-Signature', signCobBody(body))
      .send(body);
    expect(res.status).toBe(201);

    const falhas = (res.body.emissoes_pix as Array<{ erro?: string; cobranca_id?: string }>).filter(
      (e) => e.erro,
    );
    expect(falhas).toHaveLength(2);

    const [{ cb }] = await dataSource.query(
      `SELECT count(*)::int AS cb FROM cobrancas_boleto cb
       JOIN titulos_receber tr ON tr.id = cb.titulo_receber_id
       WHERE tr.cobranca_acordo_id = $1 AND cb.modalidade = 'PIX_COBV'`,
      [codigo],
    );
    expect(cb).toBe(3);

    const [{ pend }] = await dataSource.query(
      `SELECT count(*)::int AS pend FROM cobranca_emissao_pendente p
       JOIN titulos_receber tr ON tr.id = p.titulo_receber_id
       WHERE tr.cobranca_acordo_id = $1 AND p.resolvida_em IS NULL`,
      [codigo],
    );
    expect(pend).toBe(2);

    const jobs = app.get(CobrancaJobsService);
    const ciclo = await jobs.reemitirEmissaoPendentes(10);
    expect(ciclo.resolvidos).toBe(2);

    const [{ cb2 }] = await dataSource.query(
      `SELECT count(*)::int AS cb2 FROM cobrancas_boleto cb
       JOIN titulos_receber tr ON tr.id = cb.titulo_receber_id
       WHERE tr.cobranca_acordo_id = $1 AND cb.modalidade = 'PIX_COBV'`,
      [codigo],
    );
    expect(cb2).toBe(5);

    const [{ pend2 }] = await dataSource.query(
      `SELECT count(*)::int AS pend2 FROM cobranca_emissao_pendente p
       JOIN titulos_receber tr ON tr.id = p.titulo_receber_id
       WHERE tr.cobranca_acordo_id = $1 AND p.resolvida_em IS NULL`,
      [codigo],
    );
    expect(pend2).toBe(0);

    const rep = await request(app.getHttpServer())
      .post('/v1/integracao/cobranca/acordos')
      .set('Content-Type', 'application/json')
      .set('X-Api-Key', E2E_COB_API_KEY)
      .set('X-Signature', signCobBody(body))
      .send(body);
    expect(rep.status).toBe(200);
    expect(rep.body.emissoes_pix?.every((e: { reutilizada?: boolean }) => e.reutilizada)).toBe(true);

    const [{ cb3 }] = await dataSource.query(
      `SELECT count(*)::int AS cb3 FROM cobrancas_boleto cb
       JOIN titulos_receber tr ON tr.id = cb.titulo_receber_id
       WHERE tr.cobranca_acordo_id = $1 AND cb.modalidade = 'PIX_COBV'`,
      [codigo],
    );
    expect(cb3).toBe(5);
  });
});