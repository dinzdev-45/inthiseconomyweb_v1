import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { noCrossAppImports } from './no-cross-app-imports.js';

/**
 * Workspace boundary rules; included in the default config.
 * @type {import('eslint').Linter.Config}
 */
export const boundaries = {
  name: 'ite/boundaries',
  plugins: {
    ite: { rules: { 'no-cross-app-imports': noCrossAppImports } },
  },
  rules: {
    'ite/no-cross-app-imports': 'error',
  },
};

/**
 * Base flat config for every workspace. Apps extend it with framework
 * presets (e.g. Next.js) in their own eslint.config.js.
 */
export default defineConfig(
  {
    name: 'ite/ignores',
    ignores: ['**/dist/**', '**/.next/**', '**/.turbo/**', '**/coverage/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    name: 'ite/base',
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  boundaries,
  prettier,
);
