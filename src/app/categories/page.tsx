import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CategoriesManager } from "./manager";

export const dynamic = "force-dynamic";

export default function CategoriesPage() {
  const categories = db
    .select()
    .from(schema.categories)
    .orderBy(asc(schema.categories.label))
    .all();

  // Count transactions per category so the user can see what's in use
  const usageRows = db
    .select({
      key: schema.transactions.categoryKey,
    })
    .from(schema.transactions)
    .all();
  const usage = new Map<string, number>();
  for (const r of usageRows) {
    if (!r.key) continue;
    usage.set(r.key, (usage.get(r.key) ?? 0) + 1);
  }

  // Rules (per-merchant overrides) — useful to surface
  const rules = db.select().from(schema.categoryRules).all();
  const ruleCounts = new Map<string, number>();
  for (const r of rules) {
    ruleCounts.set(r.categoryKey, (ruleCounts.get(r.categoryKey) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Categories</h1>
        <p className="mt-1 text-sm text-slate-400">
          Rename categories to match how you think about your finances, add custom ones,
          or archive ones you don't use. Plaid-built categories can be renamed and
          archived but not deleted.
        </p>
      </header>
      <CategoriesManager
        categories={categories.map((c) => ({
          ...c,
          txnCount: usage.get(c.key) ?? 0,
          ruleCount: ruleCounts.get(c.key) ?? 0,
        }))}
      />
    </div>
  );
}
