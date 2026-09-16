import { AppError, ExternalServiceError, NotFoundError, type AppErrorOptions } from "@/lib/errors";

/**
 * Errors occurring during OAuth initiation, state verification, or code exchange.
 */
export class GoogleOAuthError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { code: "GOOGLE_OAUTH_ERROR", ...options });
    this.name = "GoogleOAuthError";
  }
}

/**
 * Errors returned by Google's Business Profile HTTP APIs or rate limits.
 */
export class GoogleApiError extends ExternalServiceError {
  public readonly status?: number;

  constructor(message: string, status?: number, options: AppErrorOptions = {}) {
    super("GoogleBusinessProfile", message, { code: "GOOGLE_API_ERROR", ...options });
    this.name = "GoogleApiError";
    this.status = status;
  }
}

/**
 * Error when a specified Google Location or Account cannot be found during selection.
 */
export class GoogleLocationNotFoundError extends NotFoundError {
  constructor(message = "Google Business Profile location not found", options: AppErrorOptions = {}) {
    super(message, { code: "GOOGLE_LOCATION_NOT_FOUND", ...options });
    this.name = "GoogleLocationNotFoundError";
  }
}

/**
 * Error when a Google Connection record is not found for a tenant.
 */
export class GoogleConnectionNotFoundError extends NotFoundError {
  constructor(message = "Google connection not found for this tenant", options: AppErrorOptions = {}) {
    super(message, { code: "GOOGLE_CONNECTION_NOT_FOUND", ...options });
    this.name = "GoogleConnectionNotFoundError";
  }
}
