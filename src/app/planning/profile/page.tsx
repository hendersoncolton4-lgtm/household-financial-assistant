import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { HOUSEHOLD_PROFILE_ID } from "@/lib/planning";
import { ProfileForm } from "./form";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  const profile = db
    .select()
    .from(schema.profile)
    .where(eq(schema.profile.id, HOUSEHOLD_PROFILE_ID))
    .get() ?? null;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <Link href="/planning" className="hover:text-slate-300">
            ← Planning
          </Link>
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-100">
          Household profile
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          The basics that everything else hinges on. Nothing here leaves your
          Mac. Income numbers don't need to be exact — close enough is fine.
        </p>
      </header>
      <ProfileForm initial={profile} />
    </div>
  );
}
