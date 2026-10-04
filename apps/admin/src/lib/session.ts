import 'server-only';

import { MeResponse } from '@ite/contracts';
import { cache } from 'react';

import { apiGetForPage } from './api/server.ts';

/** The signed-in staff member for this request (deduplicated across layout and page). */
export const getCurrentStaff = cache(() => apiGetForPage('/api/v1/admin/auth/me', MeResponse));
