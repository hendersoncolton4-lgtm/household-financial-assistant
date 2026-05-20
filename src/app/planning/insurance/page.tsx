import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  HOUSEHOLD_PROFILE_ID,
  analyzeInsuranceGaps,
} from "@/lib/planning";
import {
  INSURANCE_TYPE_LABELS,
  type InsuranceType,
} from "@/lib/db/schema";
import { formatCurrency } from "@/lib/format";
import { InsurancePolicyForm } from "./form";
import { DeletePolicyButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default function InsurancePage() {
  const profile = db
    .select()
    .from(schema.profile)
    .where(eq(schema.profile.id, HOUSEHOLD_PROFILE_ID))
    .get() ?? null;
  const policies = db.select().from(schema.insurancePolicies).all();
  const gaps = analyzeInsuranceGaps(profile, policies);

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <Link href="/planning" className="hover:text-slate-300">
            ← Planning
          </Link>
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-100">
          Insurance
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          List your current policies. Gap analysis is based on simple
          rules of thumb (10× income for life, LTD coverage, umbrella above
          $100k income) — directional only, talk to an agent or fee-only
          fiduciary before changing coverage.
        </p>
      </header>

      {gaps.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Possible gaps
          </h2>
          {gaps.map((g, i) => (
            <div
              key={i}
              className={`rounded-lg border p-4 ${
                g.severity === "high"
                  ? "border-rose-700 bg-rose-950/30"
                  : g.severity === "medium"
                  ? "border-amber-700 bg-amber-950/30"
                  : g.severity === "low"
                  ? "border-slate-700 bg-slate-900"
                  : "border-slate-800 bg-slate-900/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    g.severity === "high"
                      ? "bg-rose-500/20 text-rose-300"
                      : g.severity === "medium"
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {g.severity}
                </span>
                <h3 className="text-sm font-semibold text-slate-100">{g.label}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-300">{g.message}</p>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900">
        <header className="border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Current policies</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {policies.length === 0
              ? "Nothing logged yet."
              : `${policies.length} polic${policies.length === 1 ? "y" : "ies"}.`}
          </p>
        </header>
        {policies.length > 0 && (
          <ul className="divide-y divide-slate-800">
            {policies.map((p) => (
              <li key={p.id} className="px-5 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-100">
                      {INSURANCE_TYPE_LABELS[p.type as InsuranceType] ?? p.type}
                      {p.insuredName && (
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          — {labelFor(p.insuredName, profile)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {p.carrier && `${p.carrier} · `}
                      {p.coverageAmount != null &&
                        `${formatCurrency(p.coverageAmount)} coverage`}
                      {p.premiumMonthly != null &&
                        ` · ${formatCurrency(p.premiumMonthly)}/mo premium`}
                      {p.beneficiary && ` · Beneficiary: ${p.beneficiary}`}
                    </div>
                    {p.notes && (
                      <div className="mt-1 text-xs italic text-slate-500">{p.notes}</div>
                    )}
                  </div>
                  <DeletePolicyButton id={p.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <InsurancePolicyForm
          primaryName={profile?.primaryName ?? "Primary"}
          secondaryName={profile?.secondaryName ?? "Spouse"}
        />
      </section>
    </div>
  );
}

function labelFor(
  who: string,
  profile: { primaryName?: string | null; secondaryName?: string | null } | null
) {
  if (who === "primary") return profile?.primaryName ?? "Primary";
  if (who === "secondary") return profile?.secondaryName ?? "Spouse";
  if (who === "household") return "Household";
  return who;
}
