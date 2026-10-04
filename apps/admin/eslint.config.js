import { defineConfig } from 'eslint/config';
import config from '@ite/config/eslint';

export default defineConfig(config, {
  ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'],
});
