import { ChangePasswordRequest, LoginRequest, LoginResponse, MeResponse } from '@ite/contracts';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { DomainError } from '../../errors.ts';
import { LOGIN_RATE_LIMITS, type RateLimiter } from './rate-limit.ts';
import { toCurrentStaff, type AdminAuthService } from './service.ts';
import { SESSION_ABSOLUTE_TIMEOUT_MS, SESSION_COOKIE } from './session-token.ts';

type AdminAuthRoutesOptions = {
  auth: AdminAuthService;
  loginLimiter: RateLimiter;
  secureCookies: boolean;
};

/** /api/v1/admin/auth/* — login, me, logout, change-password. */
export const adminAuthRoutes: FastifyPluginAsyncZod<AdminAuthRoutesOptions> = async (
  app,
  { auth, loginLimiter, secureCookies },
) => {
  const setSessionCookie = (reply: FastifyReply, token: string) =>
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: secureCookies,
      maxAge: SESSION_ABSOLUTE_TIMEOUT_MS / 1000,
    });

  app.post(
    '/auth/login',
    {
      config: { permission: 'anonymous' },
      schema: { body: LoginRequest, response: { 200: LoginResponse } },
      // Rate limits run before any credential work.
      preHandler: async (request, reply) => {
        const email = request.body.email.toLowerCase();
        const { allowed, retryAfterSeconds } = loginLimiter.hit([
          { key: `login:ip:${request.ip}`, rule: LOGIN_RATE_LIMITS.ip },
          { key: `login:ip-email:${request.ip}:${email}`, rule: LOGIN_RATE_LIMITS.ipAndEmail },
        ]);
        if (!allowed) {
          reply.header('retry-after', String(retryAfterSeconds));
          throw new DomainError('RATE_LIMITED', 429, 'Too many sign-in attempts. Try again later.');
        }
      },
    },
    async (request, reply) => {
      const { token, context } = await auth.login(request.body.email, request.body.password);
      // A session presented with the login request is replaced, not kept alongside.
      if (request.adminSession) await auth.logout(request.adminSession.sessionId);
      setSessionCookie(reply, token);
      return toCurrentStaff(context);
    },
  );

  app.get(
    '/auth/me',
    {
      config: { permission: 'authenticated', allowDuringPasswordChange: true },
      schema: { response: { 200: MeResponse } },
    },
    async (request) => toCurrentStaff(request.adminSession!),
  );

  app.post(
    '/auth/logout',
    {
      config: { permission: 'authenticated', allowDuringPasswordChange: true },
      schema: { response: { 204: z.null() } },
    },
    async (request, reply) => {
      await auth.logout(request.adminSession!.sessionId);
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      return reply.code(204).send(null);
    },
  );

  app.post(
    '/auth/change-password',
    {
      config: { permission: 'authenticated', allowDuringPasswordChange: true },
      schema: { body: ChangePasswordRequest, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const { currentPassword, newPassword } = request.body;
      await auth.changePassword(request.adminSession!.staffId, currentPassword, newPassword);
      return reply.code(204).send(null);
    },
  );
};
