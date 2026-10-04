import { ROLE_PERMISSIONS, type Permission } from '@ite/contracts';
import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { DomainError } from '../errors.ts';

/**
 * What an admin route requires:
 * - a named Permission (checked against the caller's role),
 * - 'authenticated': any signed-in staff member,
 * - 'anonymous': no session at all (login only).
 */
export type PermissionDeclaration = Permission | 'authenticated' | 'anonymous';

export type AdminRouteRecord = { method: string; url: string; permission: PermissionDeclaration };

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Required on every admin-zone route; the API refuses to start without it. */
    permission?: PermissionDeclaration;
  }
}

type AuthorizeOptions = {
  /** Receives every admin route as it is registered (used by the route-coverage test). */
  registry?: AdminRouteRecord[];
};

const authorizePlugin: FastifyPluginCallback<AuthorizeOptions> = (app, { registry }, done) => {
  app.addHook('onRoute', (route) => {
    const methods = [route.method].flat();
    // CORS preflight handlers carry no business logic and never reach a handler with a session.
    if (methods.every((method) => method === 'OPTIONS')) return;

    const permission = route.config?.permission;
    if (permission === undefined) {
      throw new Error(
        `Admin route ${methods.join(',')} ${route.url} has no permission declaration. ` +
          `Set config.permission to a Permission, 'authenticated', or 'anonymous'.`,
      );
    }
    for (const method of methods) registry?.push({ method, url: route.url, permission });
  });

  app.addHook('onRequest', async (request) => {
    const permission = request.routeOptions.config.permission;
    if (permission === undefined || permission === 'anonymous' || permission === 'authenticated') {
      return;
    }
    // admin-session has already guaranteed a session for every non-anonymous route.
    const role = request.adminSession!.role;
    if (!ROLE_PERMISSIONS[role].includes(permission)) {
      throw new DomainError('FORBIDDEN', 403, 'You do not have permission to do this.');
    }
  });

  done();
};

/**
 * Permission enforcement for the admin zone (design D9). Registered after
 * admin-session so a session is always resolved first.
 */
export default fp(authorizePlugin, {
  name: 'authorize',
  fastify: '5.x',
  dependencies: ['admin-session'],
});
