import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ALL_PERMISSIONS, SYSTEM_ROLES } from '@fornatto/shared';

describe('FORNATTO API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await seedForTests(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('login inválido retorna 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@fornatto.app', password: 'errada' })
      .expect(401);
  });

  it('login válido e seleção de empresa', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@fornatto.app', password: 'fornatto123' })
      .expect(201);

    expect(login.body.accessToken).toBeDefined();
    expect(login.body.companies.length).toBeGreaterThanOrEqual(1);

    const companyId = login.body.companies[0].id;
    const selected = await request(app.getHttpServer())
      .post('/auth/select-company')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ companyId })
      .expect(201);

    expect(selected.body.accessToken).toBeDefined();
    expect(selected.body.company.id).toBe(companyId);
    expect(selected.body.permissions).toContain('branch:manage');
  });

  it('empresa atual (me) com tenant no token', async () => {
    const token = await tenantToken();
    const res = await request(app.getHttpServer())
      .get('/companies/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.slug).toBe('padaria-demo');
    expect(res.body.subscriptions).toBeDefined();
  });

  it('filial: persistência e listagem tenant-scoped', async () => {
    const token = await tenantToken();
    const slug = `loja-test-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/branches')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Loja Teste', slug })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/branches')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.some((b: { slug: string }) => b.slug === slug)).toBe(true);
  });

  it('bloqueia rotas sem empresa no token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@fornatto.app', password: 'fornatto123' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/branches')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });

  it('isolamento cross-tenant: filiais não misturam empresas', async () => {
    const tokenA = await tenantToken('padaria-demo');
    const tokenB = await tenantToken('padaria-rival');

    const rivalSlug = `rival-only-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/branches')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Filial Rival', slug: rivalSlug })
      .expect(201);

    const listA = await request(app.getHttpServer())
      .get('/branches')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(listA.body.every((b: { slug: string }) => b.slug !== rivalSlug)).toBe(true);
  });

  async function tenantToken(companySlug = 'padaria-demo') {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@fornatto.app', password: 'fornatto123' })
      .expect(201);

    const company = login.body.companies.find((c: { slug: string }) => c.slug === companySlug);
    expect(company).toBeDefined();

    const selected = await request(app.getHttpServer())
      .post('/auth/select-company')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ companyId: company.id })
      .expect(201);

    return selected.body.accessToken as string;
  }
});

async function seedForTests(prisma: PrismaService) {
  for (const code of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, description: code },
      update: {},
    });
  }

  const plan = await prisma.saasPlan.upsert({
    where: { slug: 'starter' },
    create: { name: 'Starter', slug: 'starter', priceCents: 9900 },
    update: {},
  });

  const companyA = await prisma.company.upsert({
    where: { slug: 'padaria-demo' },
    create: { name: 'Padaria Demo', slug: 'padaria-demo' },
    update: {},
  });

  const companyB = await prisma.company.upsert({
    where: { slug: 'padaria-rival' },
    create: { name: 'Padaria Rival', slug: 'padaria-rival' },
    update: {},
  });

  for (const company of [companyA, companyB]) {
    const sub = await prisma.subscription.findFirst({ where: { companyId: company.id } });
    if (!sub) {
      await prisma.subscription.create({
        data: { companyId: company.id, planId: plan.id, status: 'TRIAL' },
      });
    }
  }

  async function ensureOwnerRole(companyId: string) {
    const role = await prisma.role.upsert({
      where: { companyId_slug: { companyId, slug: SYSTEM_ROLES.OWNER } },
      create: { companyId, name: 'Owner', slug: SYSTEM_ROLES.OWNER, isSystem: true },
      update: {},
    });
    const perms = await prisma.permission.findMany();
    for (const p of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
        create: { roleId: role.id, permissionId: p.id },
        update: {},
      });
    }
    return role;
  }

  const roleA = await ensureOwnerRole(companyA.id);
  const roleB = await ensureOwnerRole(companyB.id);

  const passwordHash = await bcrypt.hash('fornatto123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@fornatto.app' },
    create: { email: 'admin@fornatto.app', name: 'Admin', passwordHash },
    update: { passwordHash },
  });

  await prisma.companyUser.upsert({
    where: { companyId_userId: { companyId: companyA.id, userId: user.id } },
    create: { companyId: companyA.id, userId: user.id, roleId: roleA.id },
    update: { roleId: roleA.id },
  });

  await prisma.companyUser.upsert({
    where: { companyId_userId: { companyId: companyB.id, userId: user.id } },
    create: { companyId: companyB.id, userId: user.id, roleId: roleB.id },
    update: { roleId: roleB.id },
  });
}