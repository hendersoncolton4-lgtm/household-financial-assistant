import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Household Financial Assistant",
  description: "Your private AI-powered financial overview, planner, and assistant.",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/accounts", label: "Accounts" },
  { href: "/transactions", label: "Transactions" },
  { href: "/goals", label: "Goals" },
  { href: "/reviews", label: "Reviews" },
  { href: "/connect", label: "Connect" },
  { href: "/chat", label: "Chat" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
              <Link href="/" className="text-lg font-semibold tracking-tight text-slate-100">
                Household Financial Assistant
              </Link>
              <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-400">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="hover:text-slate-100">
                    {n.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
            {children}
          </main>
          <footer className="border-t border-slate-800 bg-slate-900/40">
            <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-slate-500">
              For personal household use only. Not professional financial,
              tax, or legal advice — consult a CPA, attorney, or fee-only
              fiduciary for material decisions.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
