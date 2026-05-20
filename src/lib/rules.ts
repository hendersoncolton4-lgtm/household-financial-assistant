import type { CategoryRule } from "@/lib/db/schema";

/**
 * Find the best-matching rule for a (merchant, amount) pair.
 *
 * Specificity ranking, highest first:
 *  1. Both bounds set
 *  2. One bound set
 *  3. No bounds
 *
 * Within each tier, more recently updated rules win (so user edits override
 * older rules naturally).
 *
 * @param rules All rules (caller can pre-filter to the merchant if desired,
 *              but this function will filter again for safety).
 * @param merchantKey The merchant identifier (merchantName ?? name).
 * @param amount Transaction amount (use the absolute value or signed —
 *              consistent with how rules were created).
 */
export function findMatchingRule(
  rules: CategoryRule[],
  merchantKey: string,
  amount: number
): CategoryRule | null {
  const candidates = rules.filter((r) => r.merchantKey === merchantKey);
  if (candidates.length === 0) return null;

  const ranked = candidates
    .filter((r) => amountInRange(amount, r.amountMin, r.amountMax))
    .map((r) => ({ r, spec: specificity(r), updatedAt: r.updatedAt }))
    .sort((a, b) => {
      if (b.spec !== a.spec) return b.spec - a.spec;
      return b.updatedAt - a.updatedAt;
    });
  return ranked[0]?.r ?? null;
}

function amountInRange(
  amount: number,
  min: number | null,
  max: number | null
): boolean {
  // Use absolute value so rules created with positive amounts still match
  // negative-amount inflow transactions of the same magnitude.
  const a = Math.abs(amount);
  if (min != null && a < min) return false;
  if (max != null && a > max) return false;
  return true;
}

function specificity(r: CategoryRule): number {
  let s = 0;
  if (r.amountMin != null) s++;
  if (r.amountMax != null) s++;
  return s;
}
