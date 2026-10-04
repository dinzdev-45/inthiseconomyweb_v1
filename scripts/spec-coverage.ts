/**
 * OpenSpec scenario coverage: every `#### Scenario: <name>` in the selected specs
 * must have a test titled with that exact name (optionally followed by " (…)"
 * or ": …" for parameterized or extended variants).
 *
 *   node scripts/spec-coverage.ts [target ...] [--root <dir>]
 *
 * Targets:
 *   <change>             an active change: openspec/changes/<change>/specs/**\/spec.md
 *   specs                every main spec: openspec/specs/<capability>/spec.md
 *   specs/<capability>   one main spec (e.g. specs/product-management); must exist
 *
 * Default (no targets): every active change and every main spec. Active changes
 * are the folders under openspec/changes/ except archive/. An archived change is
 * no longer a target: its requirements live on as main specs, checked via specs/….
 * `--root` points at another repository root (used to test this script on fixtures).
 *
 * Exits 1 and lists the missing scenarios per target if any are uncovered;
 * exits 2 for an unknown target.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const rootFlag = args.indexOf('--root');
const root =
  rootFlag === -1
    ? fileURLToPath(new URL('..', import.meta.url))
    : resolve(args.splice(rootFlag, 2)[1] ?? '.');
const changesDir = join(root, 'openspec', 'changes');
const mainSpecsDir = join(root, 'openspec', 'specs');

function walk(dir: string, accept: (file: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.next', '.turbo', 'dist', 'generated'].includes(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path, accept);
    return accept(path) ? [path] : [];
  });
}

const activeChanges = existsSync(changesDir)
  ? readdirSync(changesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'archive')
      .map((entry) => entry.name)
      .sort()
  : [];
/** Main-spec capability paths (nested paths such as identity/user-auth are kept whole). */
const mainCapabilities = walk(mainSpecsDir, (f) => f.endsWith('/spec.md'))
  .map((file) => relative(mainSpecsDir, file).replace(/\/spec\.md$/, ''))
  .sort();

type Scenario = { name: string; capability: string };
type Target = { label: string; scenarios: () => Scenario[] };

function scenariosIn(file: string, capability: string): Scenario[] {
  return [...readFileSync(file, 'utf8').matchAll(/^#### Scenario: (.+?)\s*$/gm)].map((m) => ({
    name: m[1]!,
    capability,
  }));
}

function changeTarget(change: string): Target {
  const specsDir = join(changesDir, change, 'specs');
  return {
    label: `change "${change}"`,
    scenarios: () =>
      walk(specsDir, (f) => f.endsWith('spec.md')).flatMap((file) =>
        scenariosIn(file, relative(specsDir, file).replace(/\/spec\.md$/, '')),
      ),
  };
}

function mainSpecTarget(capability: string): Target {
  return {
    label: `main spec "${capability}"`,
    scenarios: () => scenariosIn(join(mainSpecsDir, capability, 'spec.md'), capability),
  };
}

const requested = args.length > 0 ? args : [...activeChanges, 'specs'];
const unknown: string[] = [];
const targets = requested.flatMap((name): Target[] => {
  if (name === 'specs') return mainCapabilities.map(mainSpecTarget);
  if (name.startsWith('specs/')) {
    const capability = name.slice('specs/'.length).replace(/\/+$/, '');
    if (mainCapabilities.includes(capability)) return [mainSpecTarget(capability)];
  } else if (activeChanges.includes(name)) {
    return [changeTarget(name)];
  }
  unknown.push(name);
  return [];
});

if (unknown.length > 0) {
  console.error(`Unknown target(s): ${unknown.join(', ')}.`);
  console.error(`  Active changes: ${activeChanges.join(', ') || '(none)'}`);
  console.error(
    `  Main specs: ${mainCapabilities.map((c) => `specs/${c}`).join(', ') || '(none)'}`,
  );
  console.error('  An archived change is checked through the main specs it was synced into.');
  process.exit(2);
}

/** Test titles: the first string argument of it(…)/test(…), including it.each(…)(…) and it(…, fn, timeout). */
const testFiles = ['apps', 'packages'].flatMap((dir) =>
  walk(join(root, dir), (f) => /\.(test|spec)\.tsx?$/.test(f)),
);
const titles = testFiles.flatMap((file) =>
  [
    ...readFileSync(file, 'utf8').matchAll(
      /\b(?:it|test)(?:\.each\([\s\S]*?\))?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g,
    ),
  ].map((m) => m[2]!),
);

const covers = (title: string, name: string) =>
  title === name || title.startsWith(`${name} (`) || title.startsWith(`${name}: `);

let totalMissing = 0;
for (const target of targets) {
  const scenarios = target.scenarios();
  const missing = scenarios.filter(({ name }) => !titles.some((title) => covers(title, name)));
  totalMissing += missing.length;
  console.log(
    `Spec coverage for ${target.label}: ${scenarios.length - missing.length}/${scenarios.length} scenarios have a matching test.`,
  );
  for (const { capability, name } of missing) console.error(`  missing [${capability}] ${name}`);
}

console.log(`${testFiles.length} test files scanned. Missing scenarios: ${totalMissing}`);
if (totalMissing > 0) process.exit(1);
