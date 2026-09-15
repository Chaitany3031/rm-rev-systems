import { cn } from "./cn";

export { cn };

/**
 * Shared utility functions used across the application.
 */

/**
 * Generate a cryptographically random token string.
 * Use for public tokens, verification IDs, etc.
 */
export function generateToken(bytes = 32): string {
  const array = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < bytes; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Silently compare two strings in constant time.
 * Use for token verification to prevent timing attacks.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Truncate a string for safe logging (avoid logging full tokens, secrets).
 */
export function truncateForLog(value: string, maxLength = 20): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength) + "...";
}
