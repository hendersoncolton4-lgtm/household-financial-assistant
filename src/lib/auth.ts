/**
 * Single-household auth. Both spouses share one password — we don't need
 * per-user accounts for two people who already trust each other completely.
 *
 * Session model: a signed cookie containing a timestamp + HMAC. No DB
 * session table needed. The cookie is signed with SESSION_SECRET, which
 * lives in env (rotates by changing the env var → invalidates all sessions).
 *
 * Password verification uses bcryptjs (pure JS so it works in any Node
 * runtime). Session verification uses Web Crypto HMAC so it can run in
 * Next.js Edge middleware.
 */

const SESSION_COOKIE = "hh_session";
const SESSION_DAYS = 30;

export type SessionPayload = {
  exp: number; // ms since epoch
};

/** HMAC-sign a payload with SESSION_SECRET. Web Crypto so edge-safe. */
async function sign(message: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  // base64url
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createSessionCookie(): Promise<{
  name: string;
  value: string;
  maxAge: number;
}> {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  const payload = String(exp);
  const sig = await sign(payload);
  return {
    name: SESSION_COOKIE,
    value: `${payload}.${sig}`,
    maxAge: SESSION_DAYS * 24 * 3600,
  };
}

export async function verifySessionCookie(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  const exp = parseInt(payload, 10);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await sign(payload);
  return timingSafeEqual(sig, expected);
}

/** Constant-time string comparison to avoid signature timing leaks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
