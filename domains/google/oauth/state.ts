import crypto from "node:crypto";
import { getEnvConfig } from "@/lib/env";
import { GoogleOAuthError } from "../errors";
import type { OAuthStatePayload } from "../types";

const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_STATE_SECRET = "rm-rev-systems-local-oauth-state-signing-key";

function getStateSigningSecret(): string {
  const env = getEnvConfig();
  return env.TOKEN_ENCRYPTION_SECRET || env.GOOGLE_CLIENT_SECRET || DEFAULT_STATE_SECRET;
}

/**
 * Creates a cryptographically signed OAuth state string.
 * Format: `<base64url_json_payload>.<hmac_signature_hex>`
 */
export function createOAuthState(params: {
  tenantId: string;
  redirectPath?: string;
}): string {
  if (!params.tenantId || typeof params.tenantId !== "string" || params.tenantId.trim() === "") {
    throw new GoogleOAuthError("tenantId is required to generate OAuth state");
  }

  const payload: OAuthStatePayload = {
    tenantId: params.tenantId.trim(),
    nonce: crypto.randomBytes(16).toString("hex"),
    issuedAt: Date.now(),
    redirectPath: params.redirectPath,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadJson, "utf8").toString("base64url");

  const secret = getStateSigningSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadBase64)
    .digest("hex");

  return `${payloadBase64}.${signature}`;
}

/**
 * Validates an OAuth state string:
 * - Checks format
 * - Verifies HMAC signature with constant-time equality
 * - Verifies state expiration (default 15 minutes)
 * Returns the decoded OAuthStatePayload or throws GoogleOAuthError.
 */
export function validateOAuthState(
  stateString: string,
  maxAgeMs = STATE_MAX_AGE_MS
): OAuthStatePayload {
  if (!stateString || typeof stateString !== "string") {
    throw new GoogleOAuthError("OAuth state parameter is missing or empty");
  }

  const parts = stateString.split(".");
  if (parts.length !== 2) {
    throw new GoogleOAuthError("Malformed OAuth state format");
  }

  const [payloadBase64, signature] = parts;
  if (!payloadBase64 || !signature) {
    throw new GoogleOAuthError("Invalid OAuth state segments");
  }

  const secret = getStateSigningSecret();
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadBase64)
    .digest("hex");

  // Constant-time signature comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new GoogleOAuthError("Invalid or tampered OAuth state signature");
  }

  try {
    const payloadJson = Buffer.from(payloadBase64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as OAuthStatePayload;

    if (!payload.tenantId || !payload.nonce || !payload.issuedAt) {
      throw new GoogleOAuthError("Incomplete OAuth state payload");
    }

    const age = Date.now() - payload.issuedAt;
    if (age > maxAgeMs || age < -60000) {
      // allow 60s clock skew
      throw new GoogleOAuthError("OAuth state has expired. Please initiate connection again.");
    }

    return payload;
  } catch (err) {
    if (err instanceof GoogleOAuthError) {
      throw err;
    }
    throw new GoogleOAuthError("Failed to parse OAuth state payload", {
      cause: err instanceof Error ? err : undefined,
    });
  }
}
