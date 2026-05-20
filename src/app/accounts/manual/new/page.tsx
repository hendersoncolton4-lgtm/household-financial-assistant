import { NewManualAccountForm } from "./form";

export const dynamic = "force-dynamic";

export default function NewManualAccountPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">
          Add a manual account
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          For anything Plaid can't connect — mortgages with regional servicers,
          captive auto-loan lenders, paper-check savings, etc. You'll update
          the balance manually as it changes.
        </p>
      </header>
      <NewManualAccountForm />
    </div>
  );
}
