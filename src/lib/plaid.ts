import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

function getEnv(): keyof typeof PlaidEnvironments {
  const raw = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
  if (raw === "sandbox" || raw === "development" || raw === "production") {
    return raw;
  }
  throw new Error(`PLAID_ENV must be sandbox, development, or production (got "${raw}")`);
}

let _client: PlaidApi | null = null;

export function plaid(): PlaidApi {
  if (_client) return _client;
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    throw new Error("PLAID_CLIENT_ID and PLAID_SECRET must be set in .env.local");
  }
  const config = new Configuration({
    basePath: PlaidEnvironments[getEnv()],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  });
  _client = new PlaidApi(config);
  return _client;
}
