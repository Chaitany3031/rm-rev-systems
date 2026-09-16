import { prisma } from "@/lib/db";
import { safeParse } from "@/lib/validation";
import { NotFoundError, ValidationError, log } from "@/lib/errors";
import { getGoogleProvider } from "../provider";
import { createOAuthState, validateOAuthState } from "../oauth/state";
import { encryptToken, decryptToken } from "../crypto";
import {
  GoogleOAuthError,
  GoogleConnectionNotFoundError,
} from "../errors";
import {
  initiateOAuthSchema,
  oauthCallbackQuerySchema,
  selectLocationSchema,
  disconnectSchema,
} from "./validation";
import type {
  GoogleBusinessProfileProvider,
  GoogleConnectionPublicInfo,
  InitiateOAuthResult,
  OAuthCallbackResult,
  DiscoveredAccountWithLocations,
} from "../types";
import type { GoogleConnection } from "@prisma/client";

/**
 * Sanitizes a Prisma GoogleConnection record into a public-safe DTO.
 * Strips all encrypted tokens and internal secrets.
 */
export function sanitizeGoogleConnection(
  record: GoogleConnection
): GoogleConnectionPublicInfo {
  return {
    id: record.id,
    tenantId: record.tenantId,
    provider: record.provider,
    googleAccountId: record.googleAccountId,
    googleAccountName: record.googleAccountName,
    googleLocationId: record.googleLocationId,
    googleLocationName: record.googleLocationName,
    locationTitle: record.locationTitle,
    locationAddress: record.locationAddress,
    status: record.status as "CONNECTED" | "DISCONNECTED" | "ERROR",
    errorMessage: record.errorMessage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Initiates the Google OAuth 2.0 flow for a tenant admin.
 * Verifies tenant existence, generates a signed state parameter, and constructs the Google authorization URL.
 */
export async function initiateGoogleConnection(
  input: unknown,
  provider: GoogleBusinessProfileProvider = getGoogleProvider()
): Promise<InitiateOAuthResult> {
  const parseResult = safeParse(initiateOAuthSchema, input);
  if (!parseResult.success) {
    throw new ValidationError("Invalid Google OAuth initiation input", parseResult.errors);
  }

  const { tenantId, redirectPath } = parseResult.data;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });

  if (!tenant) {
    throw new NotFoundError(`Tenant with id "${tenantId}" not found`);
  }

  const state = createOAuthState({
    tenantId: tenant.id,
    redirectPath,
  });

  const authorizationUrl = provider.getAuthorizationUrl({ state });

  log("info", "Google OAuth flow initiated", {
    tenantId: tenant.id,
  });

  return {
    authorizationUrl,
    state,
  };
}

/**
 * Processes the OAuth callback from Google.
 * Validates the state parameter, exchanges code for tokens, discovers accounts & locations,
 * and securely persists the encrypted credentials under the tenant.
 */
export async function processOAuthCallback(
  input: unknown,
  provider: GoogleBusinessProfileProvider = getGoogleProvider()
): Promise<OAuthCallbackResult> {
  const parseResult = safeParse(oauthCallbackQuerySchema, input);
  if (!parseResult.success) {
    throw new ValidationError("Invalid OAuth callback parameters", parseResult.errors);
  }

  const { code, state, error, error_description } = parseResult.data;

  if (error) {
    const errorMsg = error_description || `Google OAuth error: ${error}`;
    log("warn", "Google OAuth callback error received", { error, error_description });
    throw new GoogleOAuthError(errorMsg);
  }

  if (!code) {
    throw new GoogleOAuthError("Authorization code missing from OAuth callback");
  }

  // 1. Validate signed OAuth state
  const statePayload = validateOAuthState(state);
  const tenantId = statePayload.tenantId;

  // 2. Verify tenant existence in database
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });

  if (!tenant) {
    throw new NotFoundError(`Tenant with id "${tenantId}" not found`);
  }

  // 3. Exchange authorization code for tokens
  const tokens = await provider.exchangeAuthorizationCode(code);

  const encryptedAccessToken = encryptToken(tokens.accessToken);
  const encryptedRefreshToken = tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined;
  const tokenExpiresAt = tokens.expiresIn
    ? new Date(Date.now() + tokens.expiresIn * 1000)
    : undefined;

  // 4. Discover Google Business Profile accounts
  const accounts = await provider.listAccounts(tokens.accessToken);

  // 5. Discover locations for each account
  const discoveredAccounts: DiscoveredAccountWithLocations[] = [];
  for (const account of accounts) {
    const locations = await provider.listLocations(tokens.accessToken, account.name);
    discoveredAccounts.push({
      account,
      locations,
    });
  }

  // 6. Persist initial/updated GoogleConnection record for the tenant
  // If exactly 1 account and 1 location exist, pre-link it; otherwise persist credentials and wait for selection.
  let defaultLocationId: string | null = null;
  let defaultLocationName: string | null = null;
  let defaultLocationTitle: string | null = null;
  let defaultLocationAddress: string | null = null;
  let defaultAccountId: string | null = null;
  let defaultAccountName: string | null = null;

  if (discoveredAccounts.length === 1 && discoveredAccounts[0].locations.length === 1) {
    const singleAccount = discoveredAccounts[0].account;
    const singleLocation = discoveredAccounts[0].locations[0];

    defaultAccountId = singleAccount.name;
    defaultAccountName = singleAccount.accountName;
    defaultLocationId = singleLocation.name;
    defaultLocationName = singleLocation.name;
    defaultLocationTitle = singleLocation.title;

    if (singleLocation.storefrontAddress) {
      const addr = singleLocation.storefrontAddress;
      const lines = [...(addr.addressLines || []), addr.locality, addr.administrativeArea, addr.postalCode]
        .filter(Boolean)
        .join(", ");
      defaultLocationAddress = lines || null;
    }
  }

  const existingConnection = await prisma.googleConnection.findUnique({
    where: { tenantId: tenant.id },
  });

  const connectionRecord = await prisma.googleConnection.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      provider: "google",
      googleAccountId: defaultAccountId,
      googleAccountName: defaultAccountName,
      googleLocationId: defaultLocationId,
      googleLocationName: defaultLocationName,
      locationTitle: defaultLocationTitle,
      locationAddress: defaultLocationAddress,
      status: "CONNECTED",
      errorMessage: null,
      scope: tokens.scope,
      encryptedAccessToken,
      encryptedRefreshToken: encryptedRefreshToken || null,
      tokenExpiresAt,
    },
    update: {
      status: "CONNECTED",
      errorMessage: null,
      scope: tokens.scope,
      encryptedAccessToken,
      // Only overwrite refreshToken if a new one was issued
      ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
      tokenExpiresAt,
      // Preserve existing location if already configured and no single default override
      ...(defaultLocationId
        ? {
            googleAccountId: defaultAccountId,
            googleAccountName: defaultAccountName,
            googleLocationId: defaultLocationId,
            googleLocationName: defaultLocationName,
            locationTitle: defaultLocationTitle,
            locationAddress: defaultLocationAddress,
          }
        : existingConnection?.googleLocationId
        ? {}
        : {}),
    },
  });

  log("info", "Google OAuth callback processed and credentials persisted", {
    tenantId: tenant.id,
    accountsDiscovered: accounts.length,
    connectionId: connectionRecord.id,
  });

  return {
    tenantId: tenant.id,
    discoveredAccounts,
    connection: sanitizeGoogleConnection(connectionRecord),
  };
}

/**
 * Persists the administrator's explicit selection of a Google Business Profile location.
 * Strictly scopes the update to the authenticated tenant.
 */
export async function selectGoogleLocation(
  input: unknown
): Promise<GoogleConnectionPublicInfo> {
  const parseResult = safeParse(selectLocationSchema, input);
  if (!parseResult.success) {
    throw new ValidationError("Invalid location selection data", parseResult.errors);
  }

  const {
    tenantId,
    googleAccountId,
    googleAccountName,
    googleLocationId,
    googleLocationName,
    locationTitle,
    locationAddress,
  } = parseResult.data;

  // Verify tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });

  if (!tenant) {
    throw new NotFoundError(`Tenant with id "${tenantId}" not found`);
  }

  // Find existing connection scoped to this tenant
  const connection = await prisma.googleConnection.findUnique({
    where: { tenantId: tenant.id },
  });

  if (!connection) {
    throw new GoogleConnectionNotFoundError(
      `No Google connection found for tenant "${tenantId}". Please connect first.`
    );
  }

  const updatedConnection = await prisma.googleConnection.update({
    where: { tenantId: tenant.id },
    data: {
      googleAccountId,
      googleAccountName: googleAccountName || null,
      googleLocationId,
      googleLocationName: googleLocationName || googleLocationId,
      locationTitle,
      locationAddress: locationAddress || null,
      status: "CONNECTED",
      errorMessage: null,
    },
  });

  log("info", "Google location selected and persisted", {
    tenantId: tenant.id,
    googleLocationId,
    locationTitle,
  });

  return sanitizeGoogleConnection(updatedConnection);
}

/**
 * Retrieves the current Google connection for a tenant.
 * Returns null if no connection exists.
 */
export async function getGoogleConnectionForTenant(
  tenantId: string
): Promise<GoogleConnectionPublicInfo | null> {
  if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
    return null;
  }

  const record = await prisma.googleConnection.findUnique({
    where: { tenantId: tenantId.trim() },
  });

  if (!record) {
    return null;
  }

  return sanitizeGoogleConnection(record);
}

/**
 * Disconnects Google Business Profile for a tenant.
 * Scoped strictly to the tenant; safely clears encrypted credentials and marks DISCONNECTED.
 */
export async function disconnectGoogleConnection(
  input: unknown,
  provider: GoogleBusinessProfileProvider = getGoogleProvider()
): Promise<GoogleConnectionPublicInfo> {
  const parseResult = safeParse(disconnectSchema, input);
  if (!parseResult.success) {
    throw new ValidationError("Invalid disconnect input", parseResult.errors);
  }

  const { tenantId } = parseResult.data;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });

  if (!tenant) {
    throw new NotFoundError(`Tenant with id "${tenantId}" not found`);
  }

  const connection = await prisma.googleConnection.findUnique({
    where: { tenantId: tenant.id },
  });

  if (!connection) {
    throw new GoogleConnectionNotFoundError(
      `No Google connection found for tenant "${tenantId}"`
    );
  }

  // Attempt best-effort revocation if token exists
  if (connection.encryptedAccessToken && provider.revokeToken) {
    try {
      const accessToken = decryptToken(connection.encryptedAccessToken);
      await provider.revokeToken(accessToken);
    } catch {
      // Best-effort revocation; proceed with local disconnection
    }
  }

  const updated = await prisma.googleConnection.update({
    where: { tenantId: tenant.id },
    data: {
      status: "DISCONNECTED",
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      tokenExpiresAt: null,
      errorMessage: null,
    },
  });

  log("info", "Google Business Profile connection disconnected", {
    tenantId: tenant.id,
  });

  return sanitizeGoogleConnection(updated);
}
