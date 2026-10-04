import {
  ChangeStaffRoleRequest,
  CreateStaffRequest,
  StaffIdParams,
  StaffListResponse,
  StaffMemberResponse,
} from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import type { StaffService } from './service.ts';

/** /api/v1/admin/staff/* — staff account management (admin-access-control spec). */
export const staffRoutes: FastifyPluginAsyncZod<{ staff: StaffService }> = async (
  app,
  { staff },
) => {
  app.get(
    '/staff',
    { config: { permission: 'staff:read' }, schema: { response: { 200: StaffListResponse } } },
    async () => ({ data: await staff.list() }),
  );

  app.post(
    '/staff',
    {
      config: { permission: 'staff:manage' },
      schema: { body: CreateStaffRequest, response: { 201: StaffMemberResponse } },
    },
    async (request, reply) => {
      const member = await staff.create(request.adminSession!.staffId, request.body);
      return reply.code(201).send(member);
    },
  );

  app.patch(
    '/staff/:id/role',
    {
      config: { permission: 'staff:manage' },
      schema: {
        params: StaffIdParams,
        body: ChangeStaffRoleRequest,
        response: { 200: StaffMemberResponse },
      },
    },
    async (request) =>
      staff.changeRole(request.adminSession!.staffId, request.params.id, request.body.role),
  );

  app.post(
    '/staff/:id/deactivate',
    {
      config: { permission: 'staff:manage' },
      schema: { params: StaffIdParams, response: { 200: StaffMemberResponse } },
    },
    async (request) => staff.deactivate(request.adminSession!.staffId, request.params.id),
  );

  app.post(
    '/staff/:id/reactivate',
    {
      config: { permission: 'staff:manage' },
      schema: { params: StaffIdParams, response: { 200: StaffMemberResponse } },
    },
    async (request) => staff.reactivate(request.adminSession!.staffId, request.params.id),
  );
};
