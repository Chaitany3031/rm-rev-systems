import { describe, it, expect } from "vitest";
import { z } from "zod";
import { getEnvConfig, validateEnv } from "@/lib/env";
import { safeParse, formatZodErrors, parseOrThrow } from "@/lib/validation";
import {
  AppError,
  ValidationError,
  NotFoundError,
  AuthorizationError,
  ExternalServiceError,
} from "@/lib/errors";
import { cn, generateToken, safeEqual, truncateForLog } from "@/lib/utils";

describe("Foundation Unit Tests", () => {
  describe("Environment configuration & validation", () => {
    it("should provide valid default configuration", () => {
      const config = getEnvConfig();
      expect(config).toBeDefined();
      expect(config.NODE_ENV).toBeDefined();
      expect(typeof config.DATABASE_URL).toBe("string");
    });

    it("should validate NODE_ENV successfully for valid values", () => {
      const result = validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        AUTH_SECRET: "this-is-a-valid-production-secret-123456",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe("production");
      }
    });

    it("should reject invalid NODE_ENV values", () => {
      const result = validateEnv({
        NODE_ENV: "staging",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Validation utilities (Zod boundary parsing)", () => {
    const testSchema = z.object({
      id: z.string().min(1),
      count: z.number().int().positive(),
    });

    it("safeParse should return success and data on valid payload", () => {
      const input = { id: "item-123", count: 5 };
      const res = safeParse(testSchema, input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toEqual(input);
      }
    });

    it("safeParse should return formatted errors on invalid payload", () => {
      const input = { id: "", count: -1 };
      const res = safeParse(testSchema, input);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errors).toBeDefined();
        expect(typeof res.errors).toBe("object");
        expect(Object.keys(res.errors).length).toBeGreaterThan(0);
      }
    });

    it("parseOrThrow should return data on valid input", () => {
      const input = { id: "ok", count: 10 };
      const res = parseOrThrow(testSchema, input);
      expect(res).toEqual(input);
    });

    it("parseOrThrow should throw Error on invalid input", () => {
      const input = { id: 123, count: "bad" };
      expect(() => parseOrThrow(testSchema, input)).toThrow();
    });

    it("formatZodErrors formats issues by path", () => {
      const schema = z.object({ email: z.string().email() });
      const parsed = schema.safeParse({ email: "not-an-email" });
      if (!parsed.success) {
        const formatted = formatZodErrors(parsed.error.issues);
        expect(formatted.email).toBeDefined();
        expect(Array.isArray(formatted.email)).toBe(true);
      }
    });
  });

  describe("Error classes", () => {
    it("AppError sets code and message", () => {
      const err = new AppError("Something went wrong", { code: "CUSTOM_CODE" });
      expect(err.message).toBe("Something went wrong");
      expect(err.code).toBe("CUSTOM_CODE");
      expect(err.name).toBe("AppError");
    });

    it("ValidationError includes details map", () => {
      const details = { email: ["Invalid email"] };
      const err = new ValidationError("Validation failed", details);
      expect(err.name).toBe("ValidationError");
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.details).toEqual(details);
    });

    it("NotFoundError defaults", () => {
      const err = new NotFoundError();
      expect(err.name).toBe("NotFoundError");
      expect(err.code).toBe("NOT_FOUND");
      expect(err.message).toBe("Resource not found");
    });

    it("AuthorizationError defaults", () => {
      const err = new AuthorizationError();
      expect(err.name).toBe("AuthorizationError");
      expect(err.code).toBe("UNAUTHORIZED");
    });

    it("ExternalServiceError includes service name", () => {
      const err = new ExternalServiceError("GoogleAPI");
      expect(err.name).toBe("ExternalServiceError");
      expect(err.service).toBe("GoogleAPI");
    });
  });

  describe("Utility functions", () => {
    it("cn merges class names properly", () => {
      expect(cn("px-4", "py-2")).toBe("px-4 py-2");
      expect(cn("px-4", false && "hidden", "py-2")).toBe("px-4 py-2");
      expect(cn("p-4", "p-2")).toBe("p-2"); // tailwind-merge override
    });

    it("generateToken returns a hexadecimal string of expected length", () => {
      const token = generateToken(16);
      expect(token).toBeDefined();
      expect(token.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it("safeEqual correctly compares equal and non-equal strings", () => {
      expect(safeEqual("abc123xyz", "abc123xyz")).toBe(true);
      expect(safeEqual("abc123xyz", "abc123xyw")).toBe(false);
      expect(safeEqual("abc", "abcd")).toBe(false);
    });

    it("truncateForLog truncates longer strings and leaves shorter ones intact", () => {
      expect(truncateForLog("short", 10)).toBe("short");
      expect(truncateForLog("a very long string that should be cut off", 10)).toBe("a very lon...");
    });
  });
});
