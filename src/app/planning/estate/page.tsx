import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { HOUSEHOLD_PROFILE_ID } from "@/lib/planning";
import {
  ESTATE_CATEGORY_LABELS,
  ESTATE_STATUS_LABELS,
  type EstateCategory,
  type EstateStatus,
} from "@/lib/db/schema";
import { EstateItemRow } from "./item-row";
import { AddEstateItemForm } from "./add-form";

export const dynamic = "force-dynamic";

export default function EstatePage() {
  const profile = db
    .select()
    .from(schema.profile)
    .where(eq(schema.profile.id, HOUSEHOLD_PROFILE_ID))
    .get() ?? null;

  const items = db
    .select()
    .from(schema.estateItems)
    .orderBy(asc(schema.estateItems.sortOrder), asc(schema.estateItems.createdAt))
    .all();

  const byStatus = {
    not_started: 0,
    in_progress: 0,
    complete: 0,
    not_applicable: 0,
  } as Record<EstateStatus, number>;
  for (const i of items) {
    byStatus[i.status as EstateStatus] = (byStatus[i.status as EstateStatus] ?? 0) + 1;
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <Link href="/planning" className="hover:text-slate-300">
            ← Planning
          </Link>
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-100">
          Estate basics
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          A starter checklist for the documents most households should have in
          place. None of this is legal advice — an estate attorney is the
          right person for anything that requires a signature or a
          state-specific decision (especially trusts).
        </p>
      </header>

      <section className="grid gap-2 sm:grid-cols-4">
        <Stat label="Complete" value={byStatus.complete} color="emerald" />
        <Stat label="In progress" value={byStatus.in_progress} color="amber" />
        <Stat label="Not started" value={byStatus.not_started} color="rose" />
        <Stat label="N/A" value={byStatus.not_applicable} color="slate" />
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900">
        <header className="border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Checklist</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Click status to update. Add a "Last reviewed" date when you re-check
            beneficiary designations or update a document.
          </p>
        </header>
        <ul className="divide-y divide-slate-800">
          {items.map((it) => (
            <EstateItemRow
              key={it.id}
              item={{
                id: it.id,
                title: it.title,
                categoryLabel:
                  ESTATE_CATEGORY_LABELS[it.category as EstateCategory] ?? it.category,
                forPersonLabel: forPersonLabel(it.forPerson, profile),
                status: it.status as EstateStatus,
                lastReviewed: it.lastReviewed,
                notes: it.notes,
              }}
              statusLabels={ESTATE_STATUS_LABELS}
            />
          ))}
        </ul>
      </section>

      <section>
        <AddEstateItemForm />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "amber" | "rose" | "slate";
}) {
  const cls = {
    emerald: "border-emerald-700 bg-emerald-950/30 text-emerald-300",
    amber: "border-amber-700 bg-amber-950/30 text-amber-300",
    rose: "border-rose-700 bg-rose-950/30 text-rose-300",
    slate: "border-slate-700 bg-slate-900 text-slate-300",
  }[color];
  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function forPersonLabel(
  who: string | null,
  profile: { primaryName?: string | null; secondaryName?: string | null } | null
): string | null {
  if (!who) return null;
  if (who === "primary") return profile?.primaryName ?? "Primary";
  if (who === "secondary") return profile?.secondaryName ?? "Spouse";
  if (who === "household") return "Household";
  return who;
}
