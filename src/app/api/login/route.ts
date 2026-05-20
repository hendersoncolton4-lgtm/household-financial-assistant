import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/auth";
import { verifyHouseholdPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password = String(body.password ?? "");
    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }
    const ok = await verifyHouseholdPassword(password);
    if (!ok) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
    const cookie = await createSessionCookie();
    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: cookie.name,
      value: cookie.value,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: cookie.maxAge,
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
