import { createPrismaClient } from '../src/client.ts';
import { assertSeedAllowed, seedCatalog, seedDevAdmins } from '../src/seed/index.ts';

try {
  assertSeedAllowed(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env at the repository root.');
  process.exit(1);
}

const prisma = createPrismaClient(databaseUrl);
try {
  for (const { email, action } of await seedDevAdmins(prisma)) {
    console.log(`${action.padEnd(9)} ${email}`);
  }
  // Same store currency as the API (STORE_CURRENCY, default IDR).
  const catalog = await seedCatalog(prisma, process.env.STORE_CURRENCY ?? 'IDR');
  for (const [table, { created, existing }] of Object.entries(catalog)) {
    console.log(`catalog   ${table.padEnd(10)} created ${created}, existing ${existing}`);
  }
} finally {
  await prisma.$disconnect();
}
