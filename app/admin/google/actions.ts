"use server";

import { requireTenantAdmin } from "@/domains/auth";
import {
  initiateGoogleConnection,
  selectGoogleLocation,
  disconnectGoogleConnection,
  getGoogleConnectionForTenant,
  type GoogleConnectionPublicInfo,
  type InitiateOAuthResult,
  type SelectLocationInput,
} from "@/domains/google";
import { ValidationError, NotFoundError, ExternalServiceError, AppError, log } from "@/lib/errors";

export type ActionResult<T> =
  | { success: true; data: T; errors?: never; message?: never }
  | { success: false; data?: never; errors: Record<string, string[]>; message?: string };

/**
 * Server Action to initiate Google OAuth 2.0 flow for an authenticated tenant.
 */
export async function initiateGoogleConnectAction(
  tenantId: string,
  redirectPath?: string
): Promise<ActionResult<InitiateOAuthResult>> {
  try {
    // 1. Authorize tenant admin
    const admin = await requireTenantAdmin(tenantId);

    // 2. Initiate connection
    const result = await initiateGoogleConnection({
      tenantId: admin.tenantId,
      redirectPath,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        success: false,
        errors: error.details ?? { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof NotFoundError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    log("error", "Error in initiateGoogleConnectAction", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      errors: {
        form: ["An unexpected error occurred while preparing Google connection. Please try again."],
      },
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Server Action to select a specific Google location for a tenant.
 */
export async function selectGoogleLocationAction(
  input: SelectLocationInput
): Promise<ActionResult<GoogleConnectionPublicInfo>> {
  try {
    // 1. Authorize tenant admin using the authenticated tenant membership.
    const admin = await requireTenantAdmin(input.tenantId);

    // 2. Use the authenticated tenant as the source of truth; browser-supplied tenant data is never trusted.
    const updated = await selectGoogleLocation({
      ...input,
      tenantId: admin.tenantId,
    });

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        success: false,
        errors: error.details ?? { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof NotFoundError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof ExternalServiceError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: "Google Business Profile service error.",
      };
    }

    log("error", "Error in selectGoogleLocationAction", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      errors: {
        form: ["An unexpected error occurred while saving the selected location. Please try again."],
      },
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Server Action to disconnect a tenant's Google Business Profile connection.
 */
export async function disconnectGoogleAction(
  tenantId: string
): Promise<ActionResult<GoogleConnectionPublicInfo>> {
  try {
    // 1. Authorize tenant admin
    const admin = await requireTenantAdmin(tenantId);

    // 2. Disconnect
    const disconnected = await disconnectGoogleConnection({
      tenantId: admin.tenantId,
    });

    return {
      success: true,
      data: disconnected,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    log("error", "Error in disconnectGoogleAction", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      errors: {
        form: ["An unexpected error occurred while disconnecting. Please try again."],
      },
      message: "An unexpected error occurred.",
    };
  }
}

/**
 * Server Action to fetch the current connection status.
 */
export async function getGoogleConnectionAction(
  tenantId: string
): Promise<ActionResult<GoogleConnectionPublicInfo | null>> {
  try {
    const admin = await requireTenantAdmin(tenantId);
    const connection = await getGoogleConnectionForTenant(admin.tenantId);

    return {
      success: true,
      data: connection,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    return {
      success: false,
      errors: { form: ["Could not load Google connection."] },
      message: "Failed to load connection.",
    };
  }
}
