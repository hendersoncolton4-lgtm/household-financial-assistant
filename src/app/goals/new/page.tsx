import { db, schema } from "@/lib/db";
import { NewGoalForm } from "./form";

export const dynamic = "force-dynamic";

export default function NewGoalPage() {
  const accountsList = db.select().from(schema.accounts).all();
  const items = db.select().from(schema.plaidItems).all();
  const accountOptions = accountsList.map((a) => {
    const inst = items.find((i) => i.id === a.itemId);
    return {
      id: a.id,
      label: `${inst?.institutionName ?? "Unknown"} — ${a.name}${a.mask ? ` ••${a.mask}` : ""}`,
      type: a.type,
      subtype: a.subtype ?? null,
      currentBalance: a.currentBalance,
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">New goal</h1>
        <p className="mt-1 text-sm text-slate-400">
          Pick a type to see the relevant fields. You can edit or delete later.
        </p>
      </header>
      <NewGoalForm accountOptions={accountOptions} />
    </div>
  );
}
