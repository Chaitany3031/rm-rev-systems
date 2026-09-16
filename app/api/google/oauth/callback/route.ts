import { NextRequest, NextResponse } from "next/server";
import { processOAuthCallback, validateOAuthState } from "@/domains/google";
import { AppError, log } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code") || undefined;
  const state = searchParams.get("state") || "";
  const error = searchParams.get("error") || undefined;
  const errorDescription = searchParams.get("error_description") || undefined;

  let tenantId: string | null = null;
  let redirectPath = "/admin/google";

  // Attempt to extract tenantId from state even if error occurs
  if (state) {
    try {
      const statePayload = validateOAuthState(state);
      tenantId = statePayload.tenantId;
      if (statePayload.redirectPath) {
        redirectPath = statePayload.redirectPath;
      }
    } catch {
      // Invalid/expired state will be handled below
    }
  }

  const baseUrl = new URL(redirectPath, request.nextUrl.origin);
  if (tenantId) {
    baseUrl.searchParams.set("tenantId", tenantId);
  }

  if (error) {
    log("warn", "Google OAuth callback received error parameter", {
      error,
      tenantId,
    });
    baseUrl.searchParams.set("error", errorDescription || error || "Google authorization was cancelled or denied");
    return NextResponse.redirect(baseUrl);
  }

  if (!code || !state) {
    baseUrl.searchParams.set("error", "Missing required OAuth callback parameters (code or state)");
    return NextResponse.redirect(baseUrl);
  }

  try {
    const result = await processOAuthCallback({
      code,
      state,
    });

    baseUrl.searchParams.set("tenantId", result.tenantId);
    baseUrl.searchParams.set("status", "connected");

    log("info", "Google OAuth callback successfully processed", {
      tenantId: result.tenantId,
    });

    return NextResponse.redirect(baseUrl);
  } catch (err) {
    const message =
      err instanceof AppError
        ? err.message
        : "An unexpected error occurred while completing Google authorization";

    log("error", "Failed to process Google OAuth callback", {
      tenantId,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });

    baseUrl.searchParams.set("error", message);
    return NextResponse.redirect(baseUrl);
  }
}
