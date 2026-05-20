import Link from "next/link";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { ageAt, HOUSEHOLD_PROFILE_ID } from "@/lib/planning";

export const dynamic = "force-dynamic";

export default function PlanningHub() {
  const profile = db
    .select()
    .from(schema.profile)
    .where(eq(schema.profile.id, HOUSEHOLD_PROFILE_ID))
    .get();
  const contributions = db.select().from(schema.taxContributions).all();
  const policies = db.select().from(schema.insurancePolicies).all();
  const estate = db.select().from(schema.estateItems).all();
  const estateComplete = estate.filter((e) => e.status === "complete").length;

  const profileSummary = profile
    ? `${profile.primaryName ?? "Primary"}${profile.primaryDob ? ` (${ageAt(profile.primaryDob)})` : ""}${profile.secondaryName ? ` + ${profile.secondaryName}${profile.secondaryDob ? ` (${ageAt(profile.secondaryDob)})` : ""}` : ""}`
    : "Not set up yet";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Planning</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          The pieces of household financial life that don't come from Plaid:
          profile + dependents, tax-advantaged account headroom, insurance, and
          estate basics. Everything here is for discussion — material moves
          should still go through a CPA, attorney, or fee-only fiduciary.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card
          href="/planning/profile"
          title="Profile"
          subtitle={profileSummary}
          desc="Names, ages, filing status, dependents, rough income — feeds the other planning sections and the chat agent."
        />
        <Card
          href="/planning/tax"
          title="Tax-advantaged accounts"
          subtitle={`${contributions.length} contribution record(s)`}
          desc="2026 IRS limits for 401(k)/403(b), IRA (Trad + Roth), HSA. Tracks what you've contributed this year and shows the headroom."
        />
        <Card
          href="/planning/insurance"
          title="Insurance"
          subtitle={`${policies.length} polic${policies.length === 1 ? "y" : "ies"} listed`}
          desc="Track life, disability, umbrella, auto, home, health policies. Surface obvious gaps relative to income + dependents."
        />
        <Card
          href="/planning/estate"
          title="Estate"
          subtitle={`${estateComplete} of ${estate.length} items complete`}
          desc="Wills, healthcare directives, powers of attorney, beneficiary check, guardianship, trust review. The basics, with status."
        />
      </section>
    </div>
  );
}

function Card({
  href,
  title,
  subtitle,
  desc,
}: {
  href: string;
  title: string;
  subtitle: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 hover:bg-slate-900/80"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        <span className="text-xs text-slate-500">{subtitle}</span>
      </div>
      <p className="mt-2 text-sm text-slate-400">{desc}</p>
    </Link>
  );
}
