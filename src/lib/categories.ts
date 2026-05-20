import { db, schema } from "@/lib/db";
import type { Category, Transaction } from "@/lib/db/schema";

export const UNCATEGORIZED_KEY = "UNCATEGORIZED";

/** Returns Map<key, Category>. Use for fast label lookup. */
export function getCategoryMap(): Map<string, Category> {
  const all = db.select().from(schema.categories).all();
  return new Map(all.map((c) => [c.key, c]));
}

/** Stable identifier for "this merchant" — same logic everywhere so rules
 *  match consistently between transactions. */
export function merchantKey(t: Pick<Transaction, "merchantName" | "name">): string {
  return t.merchantName ?? t.name;
}

/** Apply a label lookup to a categoryKey, defaulting gracefully if missing. */
export function labelForKey(
  key: string | null | undefined,
  map: Map<string, Category>
): string {
  if (!key) return "Uncategorized";
  const c = map.get(key);
  if (c) return c.label;
  // Unknown key — likely a Plaid detailed code we haven't seeded. Humanize it.
  return key
    .toLowerCase()
    .split("_")
    .map((w, i) => (i === 0 && w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
