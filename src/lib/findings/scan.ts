import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, schema } from "@/lib/db";
import { getCategoryMap } from "@/lib/categories";
import { getTransactionsSince } from "@/lib/transactions";
import {
  detectBankFees,
  detectCreditUtilization,
  detectGoalSlippage,
  detectIdleCash,
  detectSpendingAnomaly,
  detectSubscriptions,
  type DetectedFinding,
} from "./detectors";

export type ScanReport = {
  scannedAt: number;
  total: number;
  inserted: number;
  refreshed: number;
};

/**
 * Run all detectors and persist results, deduping against existing rows by
 * signature so the user's dismiss/snooze state survives re-scans.
 */
export function runScan(): ScanReport {
  const now = Date.now();

  const accounts = db.select().from(schema.accounts).all();
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  // Use a wide window for transaction-based detectors. Categories and
  // accounts are full-database lookups.
  const txns = getTransactionsSince(180);
  const goals = db.select().from(schema.goals).all();
  const catMap = getCategoryMap();

  const detected: DetectedFinding[] = [
    ...detectIdleCash(accounts),
    ...detectBankFees(txns, accountMap),
    ...detectSubscriptions(txns, accountMap),
    ...detectCreditUtilization(accounts),
    ...detectSpendingAnomaly(txns, accountMap, catMap),
    ...detectGoalSlippage(goals),
  ];

  let inserted = 0;
  let refreshed = 0;
  for (const f of detected) {
    const existing = db
      .select()
      .from(schema.findings)
      .where(eq(schema.findings.signature, f.signature))
      .get();
    if (existing) {
      // Update content + scannedAt but preserve status (dismissed/snoozed/acted stays put).
      db.update(schema.findings)
        .set({
          severity: f.severity,
          title: f.title,
          detail: f.detail,
          suggestion: f.suggestion ?? null,
          amount: f.amount ?? null,
          relatedEntityType: f.relatedEntityType ?? null,
          relatedEntityId: f.relatedEntityId ?? null,
          scannedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.findings.id, existing.id))
        .run();
      refreshed++;
    } else {
      db.insert(schema.findings)
        .values({
          id: randomUUID(),
          type: f.type,
          signature: f.signature,
          severity: f.severity,
          title: f.title,
          detail: f.detail,
          suggestion: f.suggestion ?? null,
          amount: f.amount ?? null,
          relatedEntityType: f.relatedEntityType ?? null,
          relatedEntityId: f.relatedEntityId ?? null,
          status: "new",
          snoozedUntil: null,
          scannedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      inserted++;
    }
  }

  return { scannedAt: now, total: detected.length, inserted, refreshed };
}

/**
 * Findings the user should see right now: status='new', plus snoozed findings
 * whose snooze date has expired (automatically promoted back to visible).
 */
export function getActiveFindings() {
  const all = db
    .select()
    .from(schema.findings)
    .orderBy(desc(schema.findings.updatedAt))
    .all();
  const now = Date.now();
  return all.filter((f) => {
    if (f.status === "new") return true;
    if (f.status === "snoozed" && (f.snoozedUntil ?? 0) <= now) return true;
    return false;
  });
}
