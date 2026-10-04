import type { Category, Color, Size } from '@ite/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

const { CategoriesManager } = await import('./CategoriesManager.tsx');
const { SizesManager } = await import('./SizesManager.tsx');
const { ColorsManager } = await import('./ColorsManager.tsx');

const attribution = {
  createdAt: '2026-10-04T09:15:00.000Z',
  updatedAt: '2026-10-04T09:15:00.000Z',
  createdBy: null,
  updatedBy: null,
};
const id = (n: number) => `0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2${n}`;
const categories: Category[] = [
  { id: id(1), name: 'Apparel', slug: 'apparel', status: 'ACTIVE', ...attribution },
  { id: id(2), name: 'Old Drops', slug: 'old-drops', status: 'ARCHIVED', ...attribution },
];
const sizes: Size[] = [
  { id: id(3), code: 'XL', label: 'Extra Large', sortOrder: 5, ...attribution },
];
const colors: Color[] = [
  { id: id(4), name: 'Washed Black', slug: 'washed-black', hex: '#2B2A28', ...attribution },
  { id: id(5), name: 'Undyed', slug: 'undyed', hex: null, ...attribution },
];

const pages = {
  categories: (canManage: boolean) => (
    <CategoriesManager categories={categories} status={undefined} canManage={canManage} />
  ),
  sizes: (canManage: boolean) => <SizesManager sizes={sizes} canManage={canManage} />,
  colors: (canManage: boolean) => <ColorsManager colors={colors} canManage={canManage} />,
};

/** Controls that would change data: forms, buttons other than none, and an Actions column. */
function mutationControls(html: string) {
  return {
    forms: (html.match(/<form/g) ?? []).length,
    buttons: (html.match(/<button/g) ?? []).length,
    inputs: (html.match(/<input/g) ?? []).length,
    actionsColumn: html.includes('>Actions<'),
  };
}

describe('reference-data pages without catalog:manage', () => {
  it.each(Object.entries(pages))('%s shows data without any mutation control', (_name, render) => {
    const readOnly = renderToStaticMarkup(render(false));
    expect(mutationControls(readOnly)).toEqual({
      forms: 0,
      buttons: 0,
      inputs: 0,
      actionsColumn: false,
    });
    // The same page for a manager has create forms and row actions.
    const managed = mutationControls(renderToStaticMarkup(render(true)));
    expect(managed.forms).toBeGreaterThan(0);
    expect(managed.buttons).toBeGreaterThan(0);
    expect(managed.actionsColumn).toBe(true);
  });

  it('still lists the data read-only', () => {
    const html = renderToStaticMarkup(pages.categories(false));
    expect(html).toContain('Apparel');
    expect(html).toContain('Archived');
    expect(renderToStaticMarkup(pages.colors(false))).toContain('#2B2A28');
  });
});

describe('reference-data rendering', () => {
  it('shows a swatch only for colors with a hex value, always with the hex as text', () => {
    const html = renderToStaticMarkup(pages.colors(false));
    expect((html.match(/data-testid="swatch"/g) ?? []).length).toBe(1);
    expect(html).toContain('background-color:#2B2A28');
    expect(html).toMatch(/Undyed[\s\S]*None/);
  });

  it('marks the current category status filter', () => {
    const html = renderToStaticMarkup(
      <CategoriesManager categories={[categories[1]!]} status="ARCHIVED" canManage />,
    );
    expect(html).toMatch(/aria-current="page"[^>]*>Archived</);
  });

  it('shows empty states, with a create link only for managers', () => {
    const managed = renderToStaticMarkup(<SizesManager sizes={[]} canManage />);
    expect(managed).toContain('No sizes yet.');
    expect(managed).toContain('Create the first size');
    const readOnly = renderToStaticMarkup(<SizesManager sizes={[]} canManage={false} />);
    expect(readOnly).toContain('No sizes yet.');
    expect(readOnly).not.toContain('Create the first size');
    expect(
      renderToStaticMarkup(<CategoriesManager categories={[]} status="ARCHIVED" canManage />),
    ).toContain('No categories with this status.');
  });
});
