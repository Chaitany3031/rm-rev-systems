import { z } from "zod";

/**
 * Zod validation utilities for boundary validation.
 * Use these at system boundaries (API routes, server actions, etc.)
 * to parse and validate external input before processing.
 */

/**
 * Parse input against a Zod schema, returning a typed result.
 * Does not throw — returns { success, data, errors }.
 */
export function safeParse<T>(schema: z.ZodSchema<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true as const, data: result.data, errors: undefined };
  }
  return {
    success: false as const,
    data: undefined as T | undefined,
    errors: formatZodErrors(result.error.issues),
  };
}

/**
 * Parse input against a Zod schema, throwing on failure.
 * Use when invalid input should be a hard error (e.g. config).
 */
export function parseOrThrow<T>(schema: z.ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (err) {
    const issues = err instanceof z.ZodError ? err.issues : [];
    throw new Error(`Validation failed: ${JSON.stringify(formatZodErrors(issues))}`);
  }
}

/**
 * Format Zod issues into a readable record keyed by field path.
 */
export function formatZodErrors(issues: z.ZodIssue[]): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  for (const issue of issues) {
    const path = issue.path.map((p) => String(p)).join(".");
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }
  return formatted;
}
