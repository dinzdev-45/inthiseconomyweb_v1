import { ProductStatus, type Category } from '@ite/contracts';
import Form from 'next/form';
import Link from 'next/link';

import { Button, Input, Select } from '@/components/ui';

import {
  clearSearchHref,
  isFiltered,
  listHref,
  PRODUCTS_PATH,
  type ProductListState,
} from './list-query';

const STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ARCHIVED: 'Archived',
};

/**
 * Search and filters as a GET form (design D8): submitting writes them into the URL and starts
 * again from the first page (the cursor is not a form field). Filtering happens in the API.
 */
export function ProductFilters({
  state,
  categories,
}: {
  state: ProductListState;
  categories: Category[];
}) {
  const category = categories.find((c) => c.id === state.categoryId);
  return (
    <div className="space-y-2">
      <Form
        // Re-mounts on navigation so the inputs show the URL's values.
        key={listHref({ ...state, cursor: undefined })}
        action={PRODUCTS_PATH}
        role="search"
        aria-label="Search and filter products"
        className="flex flex-wrap items-end gap-3"
      >
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Search products</span>
          <Input
            type="search"
            name="q"
            defaultValue={state.q ?? ''}
            maxLength={120}
            placeholder="Name contains…"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="block font-medium">Status</span>
          <Select name="status" defaultValue={state.status ?? ''}>
            <option value="">All except archived</option>
            {ProductStatus.options.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="block font-medium">Category</span>
          <Select name="categoryId" defaultValue={state.categoryId ?? ''}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.status === 'ARCHIVED' ? `${c.name} (archived)` : c.name}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit">Apply</Button>
      </Form>

      <p
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted"
        data-testid="active-filters"
      >
        <span>
          Showing{' '}
          {state.status
            ? `${STATUS_LABEL[state.status].toLowerCase()} products`
            : 'all products except archived'}
          {category ? ` in ${category.name}` : ''}
          {state.q ? ` matching “${state.q}”` : ''}.
        </span>
        {state.q ? (
          <Link href={clearSearchHref(state)} className="underline">
            Clear search
          </Link>
        ) : null}
        {isFiltered(state) ? (
          <Link href={PRODUCTS_PATH} className="underline">
            Clear all filters
          </Link>
        ) : null}
      </p>
    </div>
  );
}
