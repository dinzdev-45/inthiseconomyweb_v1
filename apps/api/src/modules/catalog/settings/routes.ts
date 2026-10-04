import { CatalogSettings } from '@ite/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

/**
 * /api/v1/admin/catalog/settings — read-only catalog settings (product-management spec:
 * Store currency setting). Only the store currency is exposed; no other configuration, and no
 * write route: the currency is set by `STORE_CURRENCY` on the server and nowhere else.
 */
export const catalogSettingsRoutes: FastifyPluginAsyncZod<{ storeCurrency: string }> = async (
  app,
  { storeCurrency },
) => {
  const settings: CatalogSettings = { storeCurrency };

  app.get(
    '/catalog/settings',
    { config: { permission: 'catalog:read' }, schema: { response: { 200: CatalogSettings } } },
    async () => settings,
  );
};
