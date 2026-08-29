import { NextResponse } from "next/server";
import { plaid } from "@/lib/plaid";
import { db, schema } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";

type ItemStatus = {
  id: string;
  institutionName: string | null;
  hasError: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  displayMessage: string | null;
  errorType: string | null;
  needsReauth: boolean;
  availableProducts: string[];
  billedProducts: string[];
  updateType: string | null;
  consentExpirationTime: string | null;
};

/**
 * Query Plaid's /item/get for every stored institution and report each item's
 * current health. This is what we use to diagnose sync failures — a bad item
 * usually means either the user needs to re-auth (ITEM_LOGIN_REQUIRED),
 * their consent expired (PENDING_EXPIRATION), or the institution is
 * temporarily down.
 */
export async function GET() {
  try {
    const items = db.select().from(schema.plaidItems).all();
    const results: ItemStatus[] = [];

    for (const item of items) {
      const status: ItemStatus = {
        id: item.id,
        institutionName: item.institutionName,
        hasError: false,
        errorCode: null,
        errorMessage: null,
        displayMessage: null,
        errorType: null,
        needsReauth: false,
        availableProducts: [],
        billedProducts: [],
        updateType: null,
        consentExpirationTime: null,
      };

      try {
        const accessToken = decrypt(item.accessTokenEnc);
        const res = await plaid().itemGet({ access_token: accessToken });
        const it = res.data.item;
        status.availableProducts = it.available_products ?? [];
        status.billedProducts = it.billed_products ?? [];
        status.updateType = it.update_type ?? null;
        status.consentExpirationTime = it.consent_expiration_time ?? null;

        if (it.error) {
          status.hasError = true;
          status.errorCode = it.error.error_code ?? null;
          status.errorMessage = it.error.error_message ?? null;
          status.displayMessage = it.error.display_message ?? null;
          status.errorType = it.error.error_type ?? null;
          status.needsReauth =
            it.error.error_code === "ITEM_LOGIN_REQUIRED" ||
            it.error.error_code === "PENDING_EXPIRATION" ||
            it.error.error_code === "USER_PERMISSION_REVOKED";
        }
      } catch (err) {
        // Errors thrown by the SDK typically mean the item itself is broken
        // in a way that /item/get can't answer — pull whatever we can from
        // the exception body.
        status.hasError = true;
        const anyErr = err as {
          response?: { data?: { error_code?: string; error_message?: string; display_message?: string; error_type?: string } };
          message?: string;
        };
        status.errorCode = anyErr.response?.data?.error_code ?? "UNKNOWN";
        status.errorMessage =
          anyErr.response?.data?.error_message ??
          anyErr.message ??
          "Unknown error";
        status.displayMessage = anyErr.response?.data?.display_message ?? null;
        status.errorType = anyErr.response?.data?.error_type ?? null;
        status.needsReauth =
          status.errorCode === "ITEM_LOGIN_REQUIRED" ||
          status.errorCode === "PENDING_EXPIRATION" ||
          status.errorCode === "USER_PERMISSION_REVOKED";
      }

      results.push(status);
    }

    return NextResponse.json({ items: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
