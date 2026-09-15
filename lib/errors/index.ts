/**
 * Reusable error classes and conventions.
 *
 * All errors in the application should extend AppError so that callers
 * can distinguish expected failures from unexpected crashes.
 */

export type AppErrorOptions = {
  code?: string;
  cause?: Error;
};

/** Base class for all application-level errors. */
export class AppError extends Error {
  public readonly code: string;
  public readonly cause?: Error;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = "AppError";
    this.code = options.code ?? "APP_ERROR";
    this.cause = options.cause;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Invalid input received from a client or external system. */
export class ValidationError extends AppError {
  public readonly details?: Record<string, string[]>;

  constructor(message: string, details?: Record<string, string[]>, options: AppErrorOptions = {}) {
    super(message, { code: "VALIDATION_ERROR", ...options });
    this.name = "ValidationError";
    this.details = details;
  }
}

/** A requested resource was not found. */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found", options: AppErrorOptions = {}) {
    super(message, { code: "NOT_FOUND", ...options });
    this.name = "NotFoundError";
  }
}

/** An operation was attempted without sufficient authorization. */
export class AuthorizationError extends AppError {
  constructor(message = "Not authorized", options: AppErrorOptions = {}) {
    super(message, { code: "UNAUTHORIZED", ...options });
    this.name = "AuthorizationError";
  }
}

/** An external service failed or is unavailable. */
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(service: string, message?: string, options: AppErrorOptions = {}) {
    super(message ?? `${service} is unavailable`, { code: "EXTERNAL_SERVICE_ERROR", ...options });
    this.name = "ExternalServiceError";
    this.service = service;
  }
}

/**
 * Safe logger that never logs sensitive data.
 * Use this instead of raw console.log in server code.
 */
export function log(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}]`;
  if (level === "error") {
    console.error(`${prefix} ${message}`, meta ? JSON.stringify(meta) : "");
  } else if (level === "warn") {
    console.warn(`${prefix} ${message}`, meta ? JSON.stringify(meta) : "");
  } else {
    console.info(`${prefix} ${message}`, meta ? JSON.stringify(meta) : "");
  }
}
