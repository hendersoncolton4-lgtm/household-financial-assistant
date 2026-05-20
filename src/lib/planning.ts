import { db, schema } from "@/lib/db";
import {
  TAX_LIMITS_2026,
  type Profile,
  type TaxAccountType,
  type TaxContribution,
} from "@/lib/db/schema";

export const HOUSEHOLD_PROFILE_ID = "household";

export function getProfile(): Profile | null {
  const all = db
    .select()
    .from(schema.profile)
    .all();
  return all[0] ?? null;
}

export function ageAt(dobIso: string | null | undefined, asOf: Date = new Date()): number | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return null;
  let age = asOf.getFullYear() - dob.getFullYear();
  const m = asOf.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < dob.getDate())) age--;
  return age;
}

// ---------------------------------------------------------------------------
// Tax-advantaged contribution headroom
// ---------------------------------------------------------------------------

export type ContributionHeadroom = {
  accountType: TaxAccountType;
  person: "primary" | "secondary" | "household";
  personLabel: string;
  limit: number;
  catchupEligible: boolean;
  contributed: number;
  remaining: number;
  pctUsed: number;
  note?: string;
};

/** Combined limit across Roth + Traditional IRA for the same person. */
export type IraGroupedHeadroom = {
  person: "primary" | "secondary";
  personLabel: string;
  limit: number;
  catchupEligible: boolean;
  rothContributed: number;
  traditionalContributed: number;
  totalContributed: number;
  remaining: number;
  pctUsed: number;
};

export function computeHeadroom(
  profile: Profile | null,
  contributions: TaxContribution[],
  year: number
): {
  byAccount: ContributionHeadroom[];
  iraCombined: IraGroupedHeadroom[];
  notes: string[];
} {
  const yearContribs = contributions.filter((c) => c.year === year);
  const notes: string[] = [];
  const byAccount: ContributionHeadroom[] = [];
  const iraCombined: IraGroupedHeadroom[] = [];

  const primaryAge = profile?.primaryDob ? ageAt(profile.primaryDob) : null;
  const secondaryAge = profile?.secondaryDob ? ageAt(profile.secondaryDob) : null;
  const primaryName = profile?.primaryName ?? "Primary";
  const secondaryName = profile?.secondaryName ?? "Spouse";

  function sumFor(person: string, accountType: TaxAccountType): number {
    return yearContribs
      .filter((c) => c.person === person && c.accountType === accountType)
      .reduce((s, c) => s + c.amount, 0);
  }

  // 401(k) / 403(b)
  for (const [person, personLabel, age] of [
    ["primary", primaryName, primaryAge],
    ["secondary", secondaryName, secondaryAge],
  ] as const) {
    if (!profile) break;
    const catchup = age != null && age >= 50;
    const limit = TAX_LIMITS_2026["401k_base"] + (catchup ? TAX_LIMITS_2026["401k_catchup_50"] : 0);
    const trad = sumFor(person, "401k");
    const roth = sumFor(person, "roth_401k");
    const total = trad + roth;
    if (trad + roth > 0 || total === 0) {
      byAccount.push({
        accountType: "401k",
        person: person as "primary" | "secondary",
        personLabel: `${personLabel} — 401(k)/403(b) (Traditional + Roth)`,
        limit,
        catchupEligible: catchup,
        contributed: total,
        remaining: Math.max(0, limit - total),
        pctUsed: limit > 0 ? total / limit : 0,
        note:
          "Limit is the combined cap across Traditional and Roth elective deferrals to your employer plan.",
      });
    }
  }

  // IRA (combined Traditional + Roth)
  for (const [person, personLabel, age] of [
    ["primary", primaryName, primaryAge],
    ["secondary", secondaryName, secondaryAge],
  ] as const) {
    if (!profile) break;
    const catchup = age != null && age >= 50;
    const limit = TAX_LIMITS_2026.ira_base + (catchup ? TAX_LIMITS_2026.ira_catchup_50 : 0);
    const trad = sumFor(person, "ira_traditional");
    const roth = sumFor(person, "ira_roth");
    const total = trad + roth;
    iraCombined.push({
      person: person as "primary" | "secondary",
      personLabel,
      limit,
      catchupEligible: catchup,
      rothContributed: roth,
      traditionalContributed: trad,
      totalContributed: total,
      remaining: Math.max(0, limit - total),
      pctUsed: limit > 0 ? total / limit : 0,
    });
  }

  // HSA (household-level if family coverage)
  if (profile?.hsaEligible) {
    const family = profile.hsaCoverageType === "family";
    const baseLimit = family ? TAX_LIMITS_2026.hsa_family : TAX_LIMITS_2026.hsa_self_only;
    const oldestAge = Math.max(primaryAge ?? 0, secondaryAge ?? 0);
    const catchup = oldestAge >= 55;
    const limit = baseLimit + (catchup ? TAX_LIMITS_2026.hsa_catchup_55 : 0);
    const contributed = sumFor("household", "hsa");
    byAccount.push({
      accountType: "hsa",
      person: "household",
      personLabel: `HSA — ${family ? "family" : "self-only"} coverage`,
      limit,
      catchupEligible: catchup,
      contributed,
      remaining: Math.max(0, limit - contributed),
      pctUsed: limit > 0 ? contributed / limit : 0,
      note:
        "HSA contributions are triple tax-advantaged (deductible going in, grow tax-free, tax-free out for qualified medical). This is one of the highest-leverage accounts when available.",
    });
  }

  if (!profile?.hsaEligible) {
    notes.push(
      "If either of you is enrolled in a high-deductible health plan (HDHP), you'd be HSA-eligible — toggle that on the profile page."
    );
  }

  return { byAccount, iraCombined, notes };
}

// ---------------------------------------------------------------------------
// Insurance gap analysis (very simple rules of thumb — for discussion, not
// definitive advice).
// ---------------------------------------------------------------------------

export type InsuranceGap = {
  type: string;
  label: string;
  severity: "info" | "low" | "medium" | "high";
  message: string;
};

export function analyzeInsuranceGaps(
  profile: Profile | null,
  policies: Array<{ type: string; coverageAmount: number | null; insuredName: string | null }>
): InsuranceGap[] {
  const gaps: InsuranceGap[] = [];
  if (!profile) {
    gaps.push({
      type: "profile",
      label: "Profile",
      severity: "info",
      message:
        "Fill in the household profile (ages, income, dependents) so we can spot specific gaps.",
    });
    return gaps;
  }

  const totalIncome =
    (profile.primaryAnnualIncome ?? 0) + (profile.secondaryAnnualIncome ?? 0);
  const hasDependents = (profile.numberOfDependents ?? 0) > 0;

  // Life insurance — DIME-lite: 10× income each (if dependents)
  if (totalIncome > 0 && hasDependents) {
    const lifePolicies = policies.filter(
      (p) => p.type === "life_term" || p.type === "life_whole"
    );
    const primaryLife = sumCoverage(lifePolicies, "primary");
    const secondaryLife = sumCoverage(lifePolicies, "secondary");
    const primaryRecommended = 10 * (profile.primaryAnnualIncome ?? 0);
    const secondaryRecommended = 10 * (profile.secondaryAnnualIncome ?? 0);

    if (primaryRecommended > 0 && primaryLife < 0.7 * primaryRecommended) {
      gaps.push({
        type: "life",
        label: `Life insurance — ${profile.primaryName ?? "primary"}`,
        severity: primaryLife === 0 ? "high" : "medium",
        message: `Rule of thumb is ~10× annual income while you have dependents and a mortgage. With ${fmt(profile.primaryAnnualIncome ?? 0)} income, that's ~${fmt(primaryRecommended)}. You have ${fmt(primaryLife)} listed.`,
      });
    }
    if (secondaryRecommended > 0 && secondaryLife < 0.7 * secondaryRecommended) {
      gaps.push({
        type: "life",
        label: `Life insurance — ${profile.secondaryName ?? "spouse"}`,
        severity: secondaryLife === 0 ? "high" : "medium",
        message: `Same rule of thumb: ~10× ${profile.secondaryName ?? "spouse"}'s income (${fmt(profile.secondaryAnnualIncome ?? 0)}) = ~${fmt(secondaryRecommended)}. You have ${fmt(secondaryLife)} listed.`,
      });
    }
  }

  // Long-term disability — usually most important if working
  const ltdPolicies = policies.filter((p) => p.type === "disability_long");
  if (totalIncome > 0 && ltdPolicies.length === 0) {
    gaps.push({
      type: "disability_long",
      label: "Long-term disability",
      severity: "medium",
      message:
        "LTD typically replaces 50–70% of income if you're unable to work. Many employers offer group coverage cheaply — check with HR. Individual policies are pricier but more portable.",
    });
  }

  // Umbrella — once net worth or income reaches a meaningful level
  const hasUmbrella = policies.some((p) => p.type === "umbrella");
  if (totalIncome >= 100000 && !hasUmbrella) {
    gaps.push({
      type: "umbrella",
      label: "Umbrella liability",
      severity: "low",
      message:
        "Umbrella insurance ($1M of coverage is often ~$200–400/year) kicks in above your home and auto policies' liability limits. Worth it once you have assets to lose or kids who drive.",
    });
  }

  return gaps;
}

function sumCoverage(
  policies: Array<{ coverageAmount: number | null; insuredName: string | null }>,
  who: string
): number {
  return policies
    .filter((p) => (p.insuredName ?? "household") === who)
    .reduce((s, p) => s + (p.coverageAmount ?? 0), 0);
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
