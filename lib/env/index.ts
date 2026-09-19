import { z } from "zod";

/**
 * Server-side environment configuration schema.
 *
 * All environment variables are validated here with Zod.
 * Never commit real values — use `.env.local` for local development (gitignored).
 */
export const envSchema = z
  .object({
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

    AUTH_SECRET: z
      .string()
      .trim()
      .min(32, "AUTH_SECRET must be at least 32 characters long")
      .optional(),
    AUTH_PROVIDER: z.enum(["google", "credentials", "none"]).default("none"),
    AUTH_ENABLE_DEV_CREDENTIALS: z
      .union([z.boolean(), z.string()])
      .transform((value) => value === true || value === "true" || value === "1")
      .default(false),
    AUTH_TRUST_HOST: z
      .string()
      .transform((value) => value === "true")
      .optional(),
    NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL").optional(),
    DEV_AUTH_EMAIL: z.string().email("DEV_AUTH_EMAIL must be a valid email").optional(),
    DEV_AUTH_PASSWORD: z.string().optional(),

    // AI review-draft generation (Feature 03)
  // Provider-agnostic: the app-level AIProvider abstraction consumes these so the
  // exact vendor/model can be swapped via configuration without code changes.
  AI_PROVIDER: z
    .literal("mock")
    .default("mock"),
  AI_MOCK_DRAFT: z
    .string()
    .optional(),

  // Google Business Profile Integration (Feature 04)
  // Provider abstraction: "mock" for local dev/testing, "google" for live Google APIs.
  GOOGLE_PROVIDER: z
    .enum(["mock", "google"])
    .default("mock"),
  GOOGLE_CLIENT_ID: z
    .string()
    .optional(),
  GOOGLE_CLIENT_SECRET: z
    .string()
    .optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .url("GOOGLE_OAUTH_REDIRECT_URI must be a valid URL")
    .optional(),
    TOKEN_ENCRYPTION_SECRET: z
      .string()
      .optional(),
  })
  .superRefine((data, ctx) => {
    const devCredentialsEnabled = data.AUTH_ENABLE_DEV_CREDENTIALS === true;

    if (devCredentialsEnabled && data.NODE_ENV === "production") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_ENABLE_DEV_CREDENTIALS"],
        message: "Development credentials are not allowed in production",
      });
    }

    if (devCredentialsEnabled && (!data.DEV_AUTH_EMAIL || !data.DEV_AUTH_PASSWORD)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DEV_AUTH_EMAIL"],
        message: "DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD are required when AUTH_ENABLE_DEV_CREDENTIALS is enabled",
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

export function resetEnvCache(): void {
  cachedConfig = null;
}

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

  if (result.data.NODE_ENV === "production" && !result.data.AUTH_SECRET) {
    throw new Error("Environment configuration invalid: AUTH_SECRET is required in production");
  }

  cachedConfig = result.data;
  return cachedConfig;
}
