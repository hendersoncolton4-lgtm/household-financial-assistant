import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import "./globals.css";
import { LogoutButton } from "./logout-button";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Household Financial Assistant",
  description: "Your private AI-powered financial overview, planner, and assistant.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Finance",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/accounts", label: "Accounts" },
  { href: "/transactions", label: "Transactions" },
  { href: "/spending", label: "Spending" },
  { href: "/categories", label: "Categories" },
  { href: "/goals", label: "Goals" },
  { href: "/findings", label: "Findings" },
  { href: "/planning", label: "Planning" },
  { href: "/research", label: "Research" },
  { href: "/holdings", label: "Holdings" },
  { href: "/trading", label: "Trading" },
  { href: "/funds", label: "Funds" },
  { href: "/congress", label: "Congress" },
  { href: "/reviews", label: "Reviews" },
  { href: "/connect", label: "Connect" },
  { href: "/chat", label: "Chat" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Best-effort: only show the nav + logout when logged in. Middleware is
  // what actually enforces auth — this is purely cosmetic so the login page
  // and any redirects show a clean header.
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifySessionCookie(sessionCookie);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
              <Link href="/" className="text-lg font-semibold tracking-tight text-slate-100">
                Household Financial Assistant
              </Link>
              {isLoggedIn && (
                <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-400">
                  {NAV.map((n) => (
                    <Link key={n.href} href={n.href} className="hover:text-slate-100">
                      {n.label}
                    </Link>
                  ))}
                </nav>
              )}
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
            {children}
          </main>
          <footer className="border-t border-slate-800 bg-slate-900/40">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs text-slate-500">
              <span>
                For personal household use only. Not professional financial,
                tax, or legal advice — consult a CPA, attorney, or fee-only
                fiduciary for material decisions.
              </span>
              {isLoggedIn && <LogoutButton />}
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
