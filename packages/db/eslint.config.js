import { defineConfig } from 'eslint/config';
import config from '@ite/config/eslint';

export default defineConfig(config, { ignores: ['src/generated/**'] });
