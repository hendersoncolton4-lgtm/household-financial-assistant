#!/usr/bin/env node
/**
 * One-shot helper to generate the HOUSEHOLD_PASSWORD_HASH for .env.local.
 * The hash is base64-encoded — Next.js's dotenv-expand would otherwise
 * destroy bcrypt's `$2b$12$…` separators thinking they were variable refs.
 *
 * Usage:
 *   node scripts/hash-password.mjs 'YourPasswordHere'
 *
 * Then copy the printed line into .env.local.
 */
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs 'YourPasswordHere'");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const encoded = Buffer.from(hash, "utf-8").toString("base64");
console.log("");
console.log("Add this line to .env.local:");
console.log("");
console.log(`HOUSEHOLD_PASSWORD_HASH=${encoded}`);
console.log("");
console.log("Also generate a session secret if you haven't (any 32+ char random string works):");
console.log(
  `SESSION_SECRET=${[...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`
);
console.log("");
