import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { DomainError } from '../errors.ts';
import type { AdminAuthService, AdminSessionContext } from '../modules/admin-auth/service.ts';
import { SESSION_COOKIE } from '../modules/admin-auth/session-token.ts';

declare module 'fastify' {
  interface FastifyRequest {
    adminSession: AdminSessionContext | null;
  }
  interface FastifyContextConfig {
    /** Admin route callable while a temporary password is still unchanged (me, logout, change-password). */
    allowDuringPasswordChange?: boolean;
  }
}

type AdminSessionOptions = { auth: AdminAuthService };

const adminSessionPlugin: FastifyPluginCallback<AdminSessionOptions> = (app, { auth }, done) => {
  app.addHook('onRequest', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    request.adminSession = token ? await auth.authenticate(token) : null;
    if (token && !request.adminSession) reply.clearCookie(SESSION_COOKIE, { path: '/' });

    const config = request.routeOptions.config;
    // Routes declared `permission: 'anonymous'` (only login) need no session.
    if (config.permission === 'anonymous') return;
    if (!request.adminSession) {
      throw new DomainError('UNAUTHENTICATED', 401, 'Sign in to continue.');
    }
    if (request.adminSession.mustChangePassword && !config.allowDuringPasswordChange) {
      throw new DomainError(
        'PASSWORD_CHANGE_REQUIRED',
        403,
        'Change your temporary password to continue.',
      );
    }
  });
  done();
};

/**
 * Resolves the session cookie on every admin-zone request and fails closed:
 * no live session → 401, temporary password → 403 except on allowed routes.
 */
export default fp(adminSessionPlugin, { name: 'admin-session', fastify: '5.x' });
