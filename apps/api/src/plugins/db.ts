import { createPrismaClient, type PrismaClient } from '@ite/db';
import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    db: PrismaClient;
  }
}

type DbOptions = { databaseUrl: string };

const dbPlugin: FastifyPluginCallback<DbOptions> = (app, { databaseUrl }, done) => {
  // The client connects lazily, so the API starts (and /health answers) even when the database is down.
  const db = createPrismaClient(databaseUrl);
  app.decorate('db', db);
  app.addHook('onClose', async () => {
    await db.$disconnect();
  });
  done();
};

/** Exposes the Prisma client as `app.db` and disconnects it on close. */
export default fp(dbPlugin, { name: 'db', fastify: '5.x' });
