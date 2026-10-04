import fs from 'node:fs';
import path from 'node:path';

/**
 * Forbids importing code that belongs to an app (apps/<name>) from anywhere
 * outside that app — by workspace package name (`@ite/<name>`) or by a
 * relative path that resolves into it. Shared code belongs in packages/.
 */

/** @type {Map<string, string | null>} */
const rootCache = new Map();

/**
 * @param {string} dir
 * @returns {string | null}
 */
function findWorkspaceRoot(dir) {
  const cached = rootCache.get(dir);
  if (cached !== undefined) return cached;
  const parent = path.dirname(dir);
  const root = fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))
    ? dir
    : parent === dir
      ? null
      : findWorkspaceRoot(parent);
  rootCache.set(dir, root);
  return root;
}

/**
 * @param {string} root
 * @param {string} absPath
 * @returns {string | null} the app directory name, or null if not inside apps/
 */
function appOf(root, absPath) {
  const [top, name] = path.relative(root, absPath).split(path.sep);
  return top === 'apps' && name ? name : null;
}

/** @type {import('eslint').Rule.RuleModule} */
export const noCrossAppImports = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow importing one app from another app or from a package' },
    messages: {
      crossApp:
        "'{{source}}' belongs to apps/{{target}}. Apps must not import other apps; move shared code to packages/.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename;
    const root = findWorkspaceRoot(path.dirname(filename));
    if (!root) return {};
    const ownApp = appOf(root, filename);

    /** @param {import('eslint').Rule.Node} node */
    const check = (node) => {
      const source = 'source' in node ? node.source : null;
      if (!source || source.type !== 'Literal' || typeof source.value !== 'string') return;
      const specifier = source.value;

      let target = null;
      const scoped = /^@ite\/([^/]+)/.exec(specifier);
      if (scoped?.[1] && fs.existsSync(path.join(root, 'apps', scoped[1]))) {
        target = scoped[1];
      } else if (specifier.startsWith('.')) {
        target = appOf(root, path.resolve(path.dirname(filename), specifier));
      }

      if (target && target !== ownApp) {
        context.report({
          node: source,
          messageId: 'crossApp',
          data: { source: specifier, target },
        });
      }
    };

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
    };
  },
};
