import type { AdminDrop, AdminDropListItem, DropCandidate } from '@ite/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

const { DropList } = await import('./DropList.tsx');
const { DropForm } = await import('./DropForm.tsx');
const { DropActions } = await import('./DropActions.tsx');
const { DropProductPicker } = await import('./DropProductPicker.tsx');
const { addProduct, candidateState, isChanged, moveProduct, removeProduct, toPicked } =
  await import('./picker.ts');

const ID = (n: number) => `0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a${String(n).padStart(2, '0')}`;
const html = (node: React.ReactElement) => renderToStaticMarkup(node).replace(/\u00a0/g, ' ');

const product = (n: number, name: string) => ({
  id: ID(n),
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  status: 'ACTIVE' as const,
  primaryImage: null,
});
const ALPHA = product(11, 'Alpha Tee');
const BRAVO = product(12, 'Bravo Tee');
const CHARLIE = product(13, 'Charlie Tee');

const drop = (overrides: Partial<AdminDrop> = {}): AdminDrop => ({
  id: ID(1),
  slug: 'overtime',
  collection: 'COLLECTION 002',
  title: 'Overtime',
  description: null,
  releaseAt: '2099-01-01T03:00:00.000Z',
  image: null,
  status: 'DRAFT',
  products: [],
  createdAt: '2026-10-09T01:00:00.000Z',
  updatedAt: '2026-10-09T01:00:00.000Z',
  createdBy: null,
  updatedBy: null,
  ...overrides,
});

describe('admin-drops: Drops list', () => {
  it('Drops list (rows)', () => {
    const items: AdminDropListItem[] = [
      {
        id: ID(1),
        slug: 'overtime',
        collection: 'COLLECTION 002',
        title: 'Overtime',
        releaseAt: '2099-01-01T03:00:00.000Z',
        status: 'PUBLISHED',
        productCount: 2,
        updatedAt: '2026-10-09T01:00:00.000Z',
      },
    ];
    const markup = html(<DropList items={items} canManage={false} />);
    for (const text of [
      'COLLECTION 002',
      'Overtime',
      'Published',
      '1 Jan 2099, 10:00 WIB',
      '>2<',
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain(`href="/catalog/drops/${ID(1)}"`);
  });

  it('offers creating the first drop only to staff who can manage', () => {
    expect(html(<DropList items={[]} canManage />)).toContain('Create the first drop');
    expect(html(<DropList items={[]} canManage={false} />)).not.toContain('Create the first drop');
  });
});

describe('admin-drops: Drop form', () => {
  it('shows the release in WIB for editing, and every field', () => {
    const markup = html(
      <DropForm drop={drop({ image: { url: '/img/overtime.jpg', alt: 'Overtime campaign' } })} />,
    );
    expect(markup).toContain('value="2099-01-01T10:00"');
    expect(markup).toContain('type="datetime-local"');
    for (const name of ['collection', 'title', 'slug', 'description', 'imageUrl', 'imageAlt']) {
      expect(markup).toContain(`name="${name}"`);
    }
    expect(markup).toContain('Save details');
    expect(html(<DropForm />)).toContain('Create drop');
  });
});

describe('admin-drops: Drop product picker', () => {
  it("Choose a drop's products (selection logic)", () => {
    let selected = [ALPHA, BRAVO, CHARLIE].reduce(addProduct, []);
    selected = moveProduct(selected, CHARLIE.id, -1);
    selected = moveProduct(selected, CHARLIE.id, -1);
    expect(selected.map((p) => p.name)).toEqual(['Charlie Tee', 'Alpha Tee', 'Bravo Tee']);
    selected = removeProduct(selected, BRAVO.id);
    expect(selected.map((p) => p.name)).toEqual(['Charlie Tee', 'Alpha Tee']);
    // At the edges nothing moves, and adding twice keeps one.
    expect(moveProduct(selected, CHARLIE.id, -1)).toEqual(selected);
    expect(addProduct(selected, ALPHA)).toEqual(selected);
    expect(isChanged([ALPHA, CHARLIE], selected)).toBe(true);
    expect(isChanged([CHARLIE, ALPHA], selected)).toBe(false);
  });

  it('Product already in another drop (candidate state)', () => {
    const candidate = (drop: DropCandidate['drop']): DropCandidate => ({ ...ALPHA, drop });
    const other = { id: ID(2), title: 'Night Shift' };
    expect(candidateState(candidate(other), ID(1), [])).toEqual({
      kind: 'taken',
      dropTitle: 'Night Shift',
    });
    // In this drop (saved) but removed from the selection: it can be added back.
    expect(candidateState(candidate({ id: ID(1), title: 'Overtime' }), ID(1), [])).toEqual({
      kind: 'available',
    });
    expect(candidateState(candidate(null), ID(1), [ALPHA])).toEqual({ kind: 'selected' });
    expect(toPicked(candidate(other))).toEqual(ALPHA);
  });

  it('lists the saved products in order, with controls only for staff who can manage', () => {
    const d = drop({ products: [BRAVO, ALPHA] });
    const manage = html(<DropProductPicker drop={d} canManage />);
    expect(manage.indexOf('Bravo Tee')).toBeLessThan(manage.indexOf('Alpha Tee'));
    expect(manage).toContain('aria-label="Move Bravo Tee down"');
    expect(manage).toContain('Save products');
    expect(manage).toContain('role="search"');
    const read = html(<DropProductPicker drop={d} canManage={false} />);
    expect(read).toContain('Bravo Tee');
    expect(read).not.toMatch(/<button|<form|<input/);
  });
});

describe('admin-drops: Drop actions', () => {
  const buttons = (markup: string) =>
    [...markup.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]);

  it('offers Publish and Delete for a draft, and only Unpublish once published', () => {
    expect(buttons(html(<DropActions drop={drop()} canManage />))).toEqual([
      'Publish Overtime',
      'Delete Overtime',
    ]);
    const published = html(<DropActions drop={drop({ status: 'PUBLISHED' })} canManage />);
    expect(buttons(published)).toEqual(['Unpublish Overtime']);
    expect(published).toContain('Published');
    expect(published).toContain('1 Jan 2099, 10:00 WIB');
    expect(buttons(html(<DropActions drop={drop()} canManage={false} />))).toEqual([]);
  });
});
