import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ALL_PERMISSIONS, SYSTEM_ROLES } from '../../../packages/shared/src';

const prisma = new PrismaClient();

async function main() {
  for (const code of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, description: code },
      update: {},
    });
  }

  const plan = await prisma.saasPlan.upsert({
    where: { slug: 'starter' },
    create: {
      name: 'Starter',
      slug: 'starter',
      priceCents: 9900,
      maxBranches: 2,
      maxUsers: 10,
    },
    update: {},
  });

  const company = await prisma.company.upsert({
    where: { slug: 'padaria-demo' },
    create: {
      name: 'Padaria Fornatto Demo',
      slug: 'padaria-demo',
      legalName: 'Padaria Fornatto Demo LTDA',
    },
    update: {},
  });

  await prisma.branch.upsert({
    where: { companyId_slug: { companyId: company.id, slug: 'matriz' } },
    create: { companyId: company.id, name: 'Matriz Centro', slug: 'matriz' },
    update: {},
  });

  const existingSub = await prisma.subscription.findFirst({ where: { companyId: company.id } });
  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        companyId: company.id,
        planId: plan.id,
        status: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 14 * 86400000),
      },
    });
  }

  const ownerRole = await prisma.role.upsert({
    where: { companyId_slug: { companyId: company.id, slug: SYSTEM_ROLES.OWNER } },
    create: {
      companyId: company.id,
      name: 'Proprietário',
      slug: SYSTEM_ROLES.OWNER,
      isSystem: true,
    },
    update: {},
  });

  const permissions = await prisma.permission.findMany();
  for (const p of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: ownerRole.id, permissionId: p.id },
      },
      create: { roleId: ownerRole.id, permissionId: p.id },
      update: {},
    });
  }

  const passwordHash = await bcrypt.hash('fornatto123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@fornatto.app' },
    create: {
      email: 'admin@fornatto.app',
      name: 'Admin Demo',
      passwordHash,
    },
    update: { passwordHash },
  });

  await prisma.companyUser.upsert({
    where: { companyId_userId: { companyId: company.id, userId: user.id } },
    create: { companyId: company.id, userId: user.id, roleId: ownerRole.id },
    update: { roleId: ownerRole.id },
  });

  const rival = await prisma.company.upsert({
    where: { slug: 'padaria-rival' },
    create: { name: 'Padaria Rival', slug: 'padaria-rival' },
    update: {},
  });

  const rivalRole = await prisma.role.upsert({
    where: { companyId_slug: { companyId: rival.id, slug: SYSTEM_ROLES.OWNER } },
    create: { companyId: rival.id, name: 'Proprietário', slug: SYSTEM_ROLES.OWNER, isSystem: true },
    update: {},
  });

  for (const p of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: rivalRole.id, permissionId: p.id } },
      create: { roleId: rivalRole.id, permissionId: p.id },
      update: {},
    });
  }

  await prisma.companyUser.upsert({
    where: { companyId_userId: { companyId: rival.id, userId: user.id } },
    create: { companyId: rival.id, userId: user.id, roleId: rivalRole.id },
    update: { roleId: rivalRole.id },
  });

  console.log('Seed OK — admin@fornatto.app / fornatto123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });