import bcrypt from "bcryptjs";

/**
 * Verify a plain-text password against the stored bcrypt hash.
 *
 * The hash is stored base64-encoded in `HOUSEHOLD_PASSWORD_HASH` so that
 * Next.js's dotenv-expand doesn't chew off the `$XX$` segments that bcrypt
 * hashes contain (it interprets them as variable references). We decode
 * back to the raw bcrypt hash before comparing.
 */
export async function verifyHouseholdPassword(plain: string): Promise<boolean> {
  const encoded = process.env.HOUSEHOLD_PASSWORD_HASH;
  if (!encoded) {
    throw new Error(
      "HOUSEHOLD_PASSWORD_HASH not set — generate one with `node scripts/hash-password.mjs 'your-password'`"
    );
  }
  const hash = Buffer.from(encoded, "base64").toString("utf-8");
  return bcrypt.compare(plain, hash);
}

/** Hash a plain password and base64-encode it for storing in env. */
export async function hashPassword(plain: string): Promise<string> {
  const hash = await bcrypt.hash(plain, 12);
  return Buffer.from(hash, "utf-8").toString("base64");
}
