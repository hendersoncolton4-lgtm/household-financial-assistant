import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-lg">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter the household password to continue.
          </p>
        </div>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
