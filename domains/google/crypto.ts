import crypto from "node:crypto";
import { getEnvConfig } from "@/lib/env";
import { GoogleOAuthError } from "./errors";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const DEFAULT_FALLBACK_SECRET = "rm-rev-systems-local-development-secret-encryption-key";

/**
 * Derives a consistent 32-byte (256-bit) encryption key from environment configuration.
 * In production, this should be supplied via KMS or a dedicated secure environment variable.
 */
function getEncryptionKey(): Buffer {
  const env = getEnvConfig();
  const secret = env.TOKEN_ENCRYPTION_SECRET || DEFAULT_FALLBACK_SECRET;
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts sensitive string data (e.g. OAuth access or refresh tokens) using AES-256-GCM.
 * Output format: `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 */
export function encryptToken(plainText: string): string {
  if (!plainText || typeof plainText !== "string") {
    throw new GoogleOAuthError("Invalid plaintext provided for token encryption");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted token strings.
 * Verifies authenticity tag before returning plaintext.
 */
export function decryptToken(encryptedPayload: string): string {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    throw new GoogleOAuthError("Invalid encrypted payload provided for token decryption");
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new GoogleOAuthError("Malformed encrypted token payload");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new GoogleOAuthError("Malformed encrypted token payload segments");
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    if (iv.length !== IV_LENGTH || authTag.length !== 16) {
      throw new GoogleOAuthError("Invalid encryption parameters");
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new GoogleOAuthError("Failed to decrypt token: authentication or ciphertext error", {
      cause: error instanceof Error ? error : undefined,
    });
  }
}
