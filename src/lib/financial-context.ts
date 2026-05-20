import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  ESTATE_CATEGORY_LABELS,
  ESTATE_STATUS_LABELS,
  FILING_STATUS_LABELS,
  FINDING_TYPE_LABELS,
  GOAL_TYPE_LABELS,
  INSURANCE_TYPE_LABELS,
  TAX_ACCOUNT_LABELS,
  type EstateCategory,
  type EstateStatus,
  type FindingType,
  type GoalType,
  type InsuranceType,
  type TaxAccountType,
} from "@/lib/db/schema";
import { computeGoalProgress } from "@/lib/goals";
import { getCategoryMap, labelForKey } from "@/lib/categories";
import {
  cashFlow,
  detectIncomeSources,
  getTransactionsSince,
  largestTransactions,
  spendingByCategory,
  spendingByMerchant,
} from "@/lib/transactions";
import type { Account } from "@/lib/db/schema";
import { getActiveFindings } from "@/lib/findings/scan";
import {
  ageAt,
  analyzeInsuranceGaps,
  computeHeadroom,
  getProfile,
} from "@/lib/planning";
import { asc as ascending } from "drizzle-orm";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function buildFinancialContext(): string {
  const items = db.select().from(schema.plaidItems).all();
  const accountsList = db.select().from(schema.accounts).all();
  const accountMap: Map<string, Account> = new Map(
    accountsList.map((a) => [a.id, a])
  );
  const goalsList = db.select().from(schema.goals).all();
  const catMap = getCategoryMap();

  if (accountsList.length === 0) {
    return [
      "Household financial snapshot:",
      "No accounts have been connected yet. The user is in Phase 1 setup.",
      "If they ask about specific accounts, balances, or spending, gently let them know they",
      "need to visit /connect to link an account or /accounts/manual/new to add a manual entry.",
    ].join("\n");
  }

  const institutionMap = new Map(
    items.map((i) => [i.id, i.institutionName ?? "Unknown institution"])
  );

  let assets = 0;
  let liabilities = 0;
  for (const a of accountsList) {
    if (a.currentBalance == null) continue;
    if (a.type === "depository" || a.type === "investment") assets += a.currentBalance;
    else if (a.type === "credit" || a.type === "loan") liabilities += a.currentBalance;
  }
  const netWorth = assets - liabilities;

  const plaidAccts = accountsList.filter((a) => a.source === "plaid");
  const manualAccts = accountsList.filter((a) => a.source === "manual");

  const plaidLines = plaidAccts
    .map((a) => {
      const inst = institutionMap.get(a.itemId) ?? "Unknown";
      const bal = a.currentBalance == null ? "—" : fmt(a.currentBalance);
      return `  - ${inst} / ${a.name}${a.mask ? ` ••${a.mask}` : ""} (${a.subtype ?? a.type}): ${bal}`;
    })
    .join("\n");

  const manualLines = manualAccts
    .map((a) => {
      const bal = a.currentBalance == null ? "—" : fmt(a.currentBalance);
      const lender = a.lenderName ? ` [${a.lenderName}]` : "";
      const rate = a.interestRate != null ? `, ${(a.interestRate * 100).toFixed(2)}% APR` : "";
      const pmt = a.monthlyPayment != null ? `, ${fmt(a.monthlyPayment)}/mo` : "";
      return `  - ${a.name}${lender} (${a.subtype ?? a.type}): ${bal}${rate}${pmt}`;
    })
    .join("\n");

  const txns90 = getTransactionsSince(90);
  const thirty = new Date();
  thirty.setDate(thirty.getDate() - 30);
  const thirtyIso = thirty.toISOString().slice(0, 10);
  const sixty = new Date();
  sixty.setDate(sixty.getDate() - 60);
  const sixtyIso = sixty.toISOString().slice(0, 10);

  const txns30 = txns90.filter((t) => t.date >= thirtyIso);
  const txns60 = txns90.filter((t) => t.date >= sixtyIso);

  const cf30 = cashFlow(txns30, 30, accountMap);
  const cf60 = cashFlow(txns60, 60, accountMap);
  const cf90 = cashFlow(txns90, 90, accountMap);

  const incomeSources = detectIncomeSources(txns60, 100, catMap, accountMap);
  const totalIncome60 = incomeSources.reduce((s, x) => s + x.total, 0);

  const cats30 = spendingByCategory(txns30, catMap, accountMap).slice(0, 10);
  const merch30 = spendingByMerchant(txns30, 15, accountMap);
  const largest30 = largestTransactions(txns30, 10, accountMap);

  const activeGoals = goalsList.filter((g) => !g.archived);
  let goalsBlock = "";
  if (activeGoals.length > 0) {
    const goalLines = activeGoals
      .map((g) => {
        const p = computeGoalProgress(g);
        const pctStr = p.pct == null ? "—" : `${(p.pct * 100).toFixed(0)}%`;
        const target =
          g.type === "savings_rate" && g.targetAmount != null
            ? `${(g.targetAmount * 100).toFixed(0)}%`
            : g.targetAmount != null
            ? fmt(g.targetAmount)
            : "(no target)";
        const date = g.targetDate ? `, by ${g.targetDate}` : "";
        return `  - ${g.name} (${GOAL_TYPE_LABELS[g.type as GoalType] ?? g.type}): ${p.headline} [${pctStr}, ${p.status}] — target ${target}${date}`;
      })
      .join("\n");
    goalsBlock = `\nActive goals (${activeGoals.length}):\n${goalLines}\n`;
  } else {
    goalsBlock = `\nActive goals: none yet. Suggest creating one via /goals/new when relevant.\n`;
  }

  const sections: string[] = [
    "Household financial snapshot (live data, refreshed when the user hits Sync):",
    "",
    `Net worth: ${fmt(netWorth)}  (assets ${fmt(assets)} − liabilities ${fmt(liabilities)})`,
    "",
    `Plaid-connected institutions: ${items.length}. Plaid accounts: ${plaidAccts.length}. Manual entries: ${manualAccts.length}.`,
  ];
  if (plaidLines) sections.push("\nPlaid accounts:", plaidLines);
  if (manualLines)
    sections.push(
      "\nManual entries (user maintains by hand — balances may be slightly stale):",
      manualLines
    );

  sections.push(
    "",
    "Cash flow (excluding pending), aggregated across ALL transactions in window:",
    `  Last 30 days:  in ${fmt(cf30.inflow)}, out ${fmt(cf30.outflow)}, net ${fmt(cf30.net)}  (${cf30.count} txns)`,
    `  Last 60 days:  in ${fmt(cf60.inflow)}, out ${fmt(cf60.outflow)}, net ${fmt(cf60.net)}  (${cf60.count} txns)`,
    `  Last 90 days:  in ${fmt(cf90.inflow)}, out ${fmt(cf90.outflow)}, net ${fmt(cf90.net)}  (${cf90.count} txns)`
  );

  if (incomeSources.length > 0) {
    sections.push(
      "",
      `Identified income sources (credits ≥ $100, last 60 days, total ${fmt(totalIncome60)}):`,
      ...incomeSources.map(
        (s) =>
          `  - ${s.source}${s.isWages ? " [WAGES]" : ""}: ${fmt(s.total)} across ${s.count} deposit(s)${s.categoryLabel ? ` [${s.categoryLabel}]` : ""}`
      )
    );
  } else {
    sections.push(
      "",
      "Income sources: no credits ≥ $100 detected in the last 60 days. If the user expects income visibility, ask whether their paycheck account is connected, or have them hit Sync."
    );
  }

  if (cats30.length > 0) {
    const top = cats30.reduce((s, c) => s + c.total, 0);
    sections.push(
      "",
      `Spending by category, last 30 days (top ${cats30.length}, ${fmt(top)} of ${fmt(cf30.outflow)} total outflow). Categories reflect the user's current labels; if they ask "why is X in category Y," remind them they can re-categorize on the Transactions page:`,
      ...cats30.map(
        (c) => `  - ${c.label}: ${fmt(c.total)} across ${c.count} txn(s)`
      )
    );
  }

  if (merch30.length > 0) {
    sections.push(
      "",
      `Top merchants by spend, last 30 days:`,
      ...merch30.map(
        (m) => `  - ${m.merchant}: ${fmt(m.total)} across ${m.count} txn(s)`
      )
    );
  }

  if (largest30.length > 0) {
    sections.push(
      "",
      `Largest individual transactions, last 30 days:`,
      ...largest30.map((t) => {
        const catLabel = t.categoryKey ? labelForKey(t.categoryKey, catMap) : null;
        const catStr = catLabel ? ` [${catLabel}]` : "";
        const sign = t.amount < 0 ? "+" : "−";
        return `  - ${t.date} ${t.merchantName ?? t.name}: ${sign}${fmt(Math.abs(t.amount))}${catStr}`;
      })
    );
  }

  sections.push(goalsBlock);

  // === Planning: profile, tax-advantaged headroom, insurance, estate ===
  const profile = getProfile();
  const taxContribs = db.select().from(schema.taxContributions).all();
  const policies = db.select().from(schema.insurancePolicies).all();
  const estateItems = db
    .select()
    .from(schema.estateItems)
    .orderBy(asc(schema.estateItems.sortOrder))
    .all();

  if (profile) {
    const primaryAge = ageAt(profile.primaryDob);
    const secondaryAge = ageAt(profile.secondaryDob);
    const profileLines: string[] = [
      "",
      "Household profile:",
      `  - ${profile.primaryName ?? "Primary"}${primaryAge != null ? `, age ${primaryAge}` : ""}${profile.primaryAnnualIncome ? `, income ${fmt(profile.primaryAnnualIncome)}/yr` : ""}`,
    ];
    if (profile.secondaryName || profile.secondaryDob || profile.secondaryAnnualIncome) {
      profileLines.push(
        `  - ${profile.secondaryName ?? "Spouse"}${secondaryAge != null ? `, age ${secondaryAge}` : ""}${profile.secondaryAnnualIncome ? `, income ${fmt(profile.secondaryAnnualIncome)}/yr` : ""}`
      );
    }
    if (profile.filingStatus) {
      profileLines.push(
        `  Filing: ${FILING_STATUS_LABELS[profile.filingStatus] ?? profile.filingStatus}${profile.state ? `, ${profile.state}` : ""}${profile.numberOfDependents != null ? `, ${profile.numberOfDependents} dependent(s)` : ""}`
      );
    }
    if (profile.hsaEligible) {
      profileLines.push(
        `  HSA-eligible (${profile.hsaCoverageType === "family" ? "family" : "self-only"} coverage)`
      );
    }
    sections.push(...profileLines);

    // Tax headroom
    const currentYear = new Date().getFullYear();
    const { byAccount, iraCombined } = computeHeadroom(profile, taxContribs, currentYear);
    if (byAccount.length > 0 || iraCombined.length > 0) {
      sections.push("", `Tax-advantaged headroom (${currentYear}, against IRS limits):`);
      for (const h of byAccount) {
        sections.push(
          `  - ${h.personLabel}: ${fmt(h.contributed)} / ${fmt(h.limit)} (${fmt(h.remaining)} remaining)`
        );
      }
      for (const h of iraCombined) {
        sections.push(
          `  - ${h.personLabel} IRA (Trad+Roth combined): ${fmt(h.totalContributed)} / ${fmt(h.limit)} (${fmt(h.remaining)} remaining)`
        );
      }
    }

    // Insurance
    if (policies.length > 0) {
      sections.push("", `Insurance policies (${policies.length}):`);
      for (const p of policies) {
        const label = INSURANCE_TYPE_LABELS[p.type as InsuranceType] ?? p.type;
        const insured = p.insuredName ?? "household";
        const coverage = p.coverageAmount != null ? ` — ${fmt(p.coverageAmount)} coverage` : "";
        const premium = p.premiumMonthly != null ? `, ${fmt(p.premiumMonthly)}/mo` : "";
        sections.push(`  - ${label} (${insured})${coverage}${premium}`);
      }
    }

    const gaps = analyzeInsuranceGaps(profile, policies);
    if (gaps.length > 0) {
      sections.push("", "Possible insurance gaps (rule-of-thumb, discuss with an agent):");
      for (const g of gaps) {
        sections.push(`  - [${g.severity}] ${g.label}: ${g.message}`);
      }
    }

    // Estate checklist status
    if (estateItems.length > 0) {
      const summary: Record<EstateStatus, number> = {
        not_started: 0,
        in_progress: 0,
        complete: 0,
        not_applicable: 0,
      };
      for (const i of estateItems) summary[i.status as EstateStatus]++;
      sections.push(
        "",
        `Estate checklist: ${summary.complete} complete, ${summary.in_progress} in progress, ${summary.not_started} not started, ${summary.not_applicable} N/A.`
      );
      // List items still open (not complete and not N/A) so the agent can
      // suggest concrete next steps when relevant.
      const open = estateItems.filter(
        (i) => i.status !== "complete" && i.status !== "not_applicable"
      );
      if (open.length > 0) {
        sections.push("  Open items:");
        for (const i of open) {
          const cat = ESTATE_CATEGORY_LABELS[i.category as EstateCategory] ?? i.category;
          const status = ESTATE_STATUS_LABELS[i.status as EstateStatus] ?? i.status;
          sections.push(`    - ${i.title} (${cat}) — ${status}`);
        }
      }
    }
  } else {
    sections.push(
      "",
      "Household profile: not set up yet. If the user asks tax/insurance/estate questions, prompt them to fill out /planning/profile first so suggestions can be specific."
    );
  }
  void TAX_ACCOUNT_LABELS; // silence unused warning

  // Investment holdings (Phase 5b). Real positions from connected brokerages.
  const holdings = db.select().from(schema.holdings).all();
  if (holdings.length > 0) {
    const allSecurities = db.select().from(schema.securities).all();
    const secMap = new Map(allSecurities.map((s) => [s.id, s]));
    const allAccounts = db.select().from(schema.accounts).all();
    const accountMap2 = new Map(allAccounts.map((a) => [a.id, a]));
    const totalValue = holdings.reduce(
      (s, h) => s + (h.institutionValue ?? 0),
      0
    );
    // Aggregate by ticker across accounts so concentration is visible.
    const byTicker = new Map<
      string,
      { name: string; value: number; quantity: number }
    >();
    for (const h of holdings) {
      const sec = secMap.get(h.securityId);
      const key = sec?.ticker ?? sec?.name ?? "Unknown";
      const cur = byTicker.get(key) ?? {
        name: sec?.name ?? key,
        value: 0,
        quantity: 0,
      };
      cur.value += h.institutionValue ?? 0;
      cur.quantity += h.quantity;
      byTicker.set(key, cur);
    }
    const sortedPositions = Array.from(byTicker.entries())
      .map(([ticker, v]) => ({ ticker, ...v }))
      .sort((a, b) => b.value - a.value);
    sections.push(
      "",
      `Investment holdings — ${holdings.length} position rows across ${accountMap2.size > 0 ? "the connected brokerages" : "unknown"}, total ${fmt(totalValue)}:`,
      ...sortedPositions.slice(0, 15).map(
        (p) =>
          `  - ${p.ticker}: ${fmt(p.value)} (${p.quantity.toFixed(2)} shares; ${((p.value / totalValue) * 100).toFixed(1)}% of portfolio)`
      )
    );
    if (sortedPositions.length > 15) {
      sections.push(`  ...and ${sortedPositions.length - 15} smaller positions.`);
    }
  }

  // Watchlist (Phase 5). We don't fetch live prices here — that would slow
  // every chat reply on every Alpaca rate-limit. Just list what's being
  // followed and the most recent thesis content per symbol.
  const wl = db
    .select()
    .from(schema.watchlist)
    .orderBy(ascending(schema.watchlist.symbol))
    .all();
  if (wl.length > 0) {
    sections.push("", `Research watchlist (${wl.length} symbol${wl.length === 1 ? "" : "s"}):`);
    for (const w of wl) {
      sections.push(`  - ${w.symbol}${w.name ? ` (${w.name})` : ""}${w.notes ? ` — ${w.notes}` : ""}`);
    }
    // Pull the most recent thesis per symbol, but don't dump full content — too long.
    const allTheses = db
      .select()
      .from(schema.theses)
      .all()
      .sort((a, b) => b.createdAt - a.createdAt);
    const seen = new Set<string>();
    const recent = allTheses.filter((t) => {
      if (seen.has(t.symbol)) return false;
      seen.add(t.symbol);
      return true;
    });
    if (recent.length > 0) {
      sections.push(
        "",
        "Most-recent AI thesis per symbol on the watchlist (the user can view the full text at /research/[SYMBOL]):"
      );
      for (const t of recent.slice(0, 5)) {
        const snippet = t.content.slice(0, 240).replace(/\s+/g, " ");
        sections.push(
          `  - ${t.symbol} (generated ${new Date(t.createdAt).toLocaleDateString()}): ${snippet}…`
        );
      }
    }
  }

  // Followed funds (Phase 5c). Surface each fund's latest 13F top positions
  // so the chat agent can answer "what is Berkshire holding?" or
  // "which funds we follow own this stock?"
  const followedFunds = db.select().from(schema.funds).all();
  if (followedFunds.length > 0) {
    sections.push(
      "",
      `Followed funds (${followedFunds.length}) — 13F holdings. SEC requires filing within 45 days of quarter-end, so this data is up to ~45 days stale even on the day of filing:`
    );
    for (const f of followedFunds) {
      const latest = db
        .select()
        .from(schema.fundFilings)
        .where(eq(schema.fundFilings.cik, f.cik))
        .orderBy(desc(schema.fundFilings.reportDate))
        .limit(1)
        .get();
      if (!latest) {
        sections.push(`  - ${f.name}: no filings synced yet`);
        continue;
      }
      const top = db
        .select()
        .from(schema.fundHoldings)
        .where(eq(schema.fundHoldings.filingId, latest.id))
        .all()
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      const topLine = top
        .map(
          (h) =>
            `${h.ticker ?? h.issuerName} ${(h.pctOfPortfolio * 100).toFixed(1)}%`
        )
        .join(", ");
      sections.push(
        `  - ${f.name} (as of ${latest.reportDate}, ${fmt(latest.totalValue)} portfolio): top — ${topLine}`
      );
    }
  }

  // Trading queue + recent activity (Phase 6). Just headlines — full details
  // live at /trading.
  const allProposals = db.select().from(schema.proposals).all();
  const pendingProposals = allProposals.filter((p) => p.status === "pending");
  const approvedProposals = allProposals.filter((p) => p.status === "approved");
  const executedThisMonth = allProposals.filter((p) => {
    if (p.status !== "executed") return false;
    const thirty = Date.now() - 30 * 24 * 3600 * 1000;
    return p.createdAt >= thirty;
  });
  if (
    pendingProposals.length > 0 ||
    approvedProposals.length > 0 ||
    executedThisMonth.length > 0
  ) {
    sections.push("", "Paper-trading queue (Phase 6):");
    if (pendingProposals.length > 0) {
      sections.push(`  Pending approval (${pendingProposals.length}):`);
      for (const p of pendingProposals.slice(0, 10)) {
        sections.push(
          `    - ${p.side.toUpperCase()} ${p.quantity} ${p.symbol} (${p.orderType}${p.limitPrice ? ` @ $${p.limitPrice}` : ""}) — ${p.rationale.slice(0, 140)}`
        );
      }
    }
    if (approvedProposals.length > 0) {
      sections.push(`  Approved, awaiting fill: ${approvedProposals.length}`);
    }
    if (executedThisMonth.length > 0) {
      sections.push(
        `  Executed in last 30 days: ${executedThisMonth.length} trade(s).`
      );
      for (const p of executedThisMonth.slice(0, 5)) {
        sections.push(
          `    - ${p.side.toUpperCase()} ${p.filledQuantity ?? p.quantity} ${p.symbol} @ $${p.filledPrice?.toFixed(2) ?? "?"}`
        );
      }
    }
  }

  // Findings: opportunities the scanner has surfaced and the user hasn't
  // dismissed yet. Helps the chat agent answer "what should I focus on?".
  const findings = getActiveFindings();
  if (findings.length > 0) {
    const findingLines = findings.map((f) => {
      const typeLabel = FINDING_TYPE_LABELS[f.type as FindingType] ?? f.type;
      const amt = f.amount != null ? ` (~${fmt(f.amount)})` : "";
      return `  - [${f.severity.toUpperCase()}] ${typeLabel}: ${f.title}${amt}\n      ${f.detail}${f.suggestion ? `\n      Suggested: ${f.suggestion}` : ""}`;
    });
    sections.push(
      "",
      `Open findings from the opportunity scanner (${findings.length}). User can review/dismiss at /findings:`,
      ...findingLines
    );
  } else {
    sections.push(
      "",
      "Open findings: none. If the user asks 'what should I focus on?', mention they can run a scan at /findings to surface opportunities."
    );
  }

  sections.push(
    "",
    "Convention: positive transaction amounts represent money leaving the account (purchases, transfers out, fees). Negative amounts represent money entering the account (deposits, refunds, transfers in). This matches Plaid's API.",
    "",
    "If the user asks something this snapshot can't answer (e.g. spending in a specific older month), say what you can see and what you can't, and suggest hitting Sync or extending the window. Don't invent numbers."
  );

  return sections.join("\n");
}
