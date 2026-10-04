import type { CategoryStatus, VariantStatus } from '@ite/db';

/*
 * Activation readiness (product-management spec, design D3). A product may become ACTIVE only
 * when all conditions hold, and an ACTIVE product must keep satisfying them: every mutation that
 * could break one runs these checks on rows locked in the fixed order (category, product,
 * variants), so the check and the change are atomic.
 */

type VariantPrice = { status: VariantStatus; priceOverrideAmount: number | null };

/** Whether at least one ACTIVE variant has an effective price above zero at `basePriceAmount`. */
export function hasQualifyingVariant(
  basePriceAmount: number,
  variants: readonly VariantPrice[],
): boolean {
  return variants.some(
    (variant) =>
      variant.status === 'ACTIVE' && (variant.priceOverrideAmount ?? basePriceAmount) > 0,
  );
}

export type ReadinessState = {
  categoryStatus: CategoryStatus;
  basePriceAmount: number;
  variants: readonly VariantPrice[];
  imageCount: number;
  primaryImageCount: number;
};

/** Every unmet activation condition, in a fixed order, as plain text. Empty when ready. */
export function readinessProblems(state: ReadinessState): string[] {
  const problems: string[] = [];
  if (state.categoryStatus !== 'ACTIVE') problems.push('its category is archived');
  if (!state.variants.some((variant) => variant.status === 'ACTIVE')) {
    problems.push('it has no active variant');
  } else if (!hasQualifyingVariant(state.basePriceAmount, state.variants)) {
    problems.push('no active variant is priced above zero');
  }
  if (state.imageCount === 0) problems.push('it has no images');
  else if (state.primaryImageCount !== 1) problems.push('it has no primary image');
  return problems;
}
