import { z } from "zod";

/**
 * Server-side environment configuration schema.
 *
 * All environment variables are validated here with Zod.
 * Never commit real values — use `.env.local` for local development (gitignored).
 */
export const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database (PostgreSQL via Prisma)
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .default("postgresql://postgres:postgres@localhost:5432/rm_review_systems?schema=public"),

  // Next.js public URL (optional)
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL")
    .optional(),

  // AI review-draft generation (Feature 03)
  // Provider-agnostic: the app-level AIProvider abstraction consumes these so the
  // exact vendor/model can be swapped via configuration without code changes.
  AI_PROVIDER: z
    .literal("mock")
    .default("mock"),
  AI_MOCK_DRAFT: z
    .string()
    .default(
      "I recently used RM Solution and was impressed by the quality of their work. The team was professional and delivered exactly what I needed. I would definitely recommend them to others looking for reliable business solutions."
    ),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

/**
 * Validates given input or process.env against the envSchema.
 */
export function validateEnv(input?: unknown) {
  return envSchema.safeParse(input ?? process.env);
}

/**
 * Returns typed environment configuration, parsing process.env.
 * Throws a descriptive error if required environment variables are invalid.
 */
export function getEnvConfig(): EnvConfig {
  if (cachedConfig) return cachedConfig;

  const result = validateEnv();

  if (!result.success) {
    const missing = result.error.flatten().fieldErrors;
    const messages = Object.entries(missing)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
      .join("; ");
    throw new Error(`Environment configuration invalid: ${messages}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}
