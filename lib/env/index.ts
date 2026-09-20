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

    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional(),
    CLERK_SIGN_IN_URL: z.string().optional(),
    CLERK_SIGN_UP_URL: z.string().optional(),

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
    TOKEN_ENCRYPTION_SECRET: z.string().min(1, "TOKEN_ENCRYPTION_SECRET is required"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
          message: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required in production",
        });
      }

      if (!data.CLERK_SECRET_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CLERK_SECRET_KEY"],
          message: "CLERK_SECRET_KEY is required in production",
        });
      }

      if (!data.TOKEN_ENCRYPTION_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["TOKEN_ENCRYPTION_SECRET"],
          message: "TOKEN_ENCRYPTION_SECRET is required in production",
        });
      }
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

  if (
    result.data.NODE_ENV === "production" &&
    (!result.data.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !result.data.CLERK_SECRET_KEY)
  ) {
    throw new Error(
      "Environment configuration invalid: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are required in production"
    );
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export function getTokenEncryptionSecret(): string {
  const secret = getEnvConfig().TOKEN_ENCRYPTION_SECRET;

  if (!secret) {
    throw new Error("Environment configuration invalid: TOKEN_ENCRYPTION_SECRET is required");
  }

  return secret;
}
