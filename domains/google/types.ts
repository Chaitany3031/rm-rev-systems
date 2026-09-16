/**
 * Google domain types and interfaces.
 *
 * Scoped strictly to Feature 04: Google Business Profile connection,
 * account discovery, location discovery, and tenant-scoped connection management.
 */

export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType: string;
}

export interface GoogleAccount {
  name: string; // e.g., "accounts/108392019482"
  accountName: string; // display name e.g., "RM Solution Org"
  type?: string; // e.g., "PERSONAL", "ORGANIZATION"
  verificationState?: string; // e.g., "VERIFIED", "UNVERIFIED"
  vettedState?: string;
}

export interface GoogleStorefrontAddress {
  addressLines?: string[];
  locality?: string; // city
  administrativeArea?: string; // state / province
  postalCode?: string;
  regionCode?: string; // country code e.g., "US"
}

export interface GoogleLocation {
  name: string; // e.g., "locations/948201948" or "accounts/108392019482/locations/948201948"
  title: string; // business title e.g., "RM Solution"
  storefrontAddress?: GoogleStorefrontAddress;
  websiteUri?: string;
  phoneNumbers?: {
    primaryPhone?: string;
  };
}

export type GoogleConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";

/**
 * Sanitized public representation of a tenant's Google Connection.
 * Absolutely NO tokens or encrypted credential material is ever exposed here.
 */
export interface GoogleConnectionPublicInfo {
  id: string;
  tenantId: string;
  provider: string;
  googleAccountId: string | null;
  googleAccountName: string | null;
  googleLocationId: string | null;
  googleLocationName: string | null;
  locationTitle: string | null;
  locationAddress: string | null;
  status: GoogleConnectionStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthStatePayload {
  tenantId: string;
  nonce: string;
  issuedAt: number;
  redirectPath?: string;
}

export interface InitiateOAuthInput {
  tenantId: string;
  redirectPath?: string;
}

export interface InitiateOAuthResult {
  authorizationUrl: string;
  state: string;
}

export interface HandleOAuthCallbackInput {
  code: string;
  state: string;
  expectedTenantId?: string;
}

export interface DiscoveredAccountWithLocations {
  account: GoogleAccount;
  locations: GoogleLocation[];
}

export interface OAuthCallbackResult {
  tenantId: string;
  discoveredAccounts: DiscoveredAccountWithLocations[];
  connection: GoogleConnectionPublicInfo;
}

export interface SelectLocationInput {
  tenantId: string;
  googleAccountId: string;
  googleAccountName?: string;
  googleLocationId: string;
  googleLocationName?: string;
  locationTitle: string;
  locationAddress?: string;
}

export interface DisconnectInput {
  tenantId: string;
}

/**
 * Google review data normalized from Google Business Profile Review API.
 */
export interface GoogleReviewData {
  googleReviewName: string; // Stable resource name e.g. "accounts/123/locations/456/reviews/789"
  googleLocationName: string;
  reviewerDisplayName?: string;
  starRating?: number; // 1-5
  comment?: string;
  reviewCreateTime?: Date;
  reviewUpdateTime?: Date;
  replyComment?: string;
  replyUpdateTime?: Date;
  reviewReplyUrl?: string;
  replyState?: string;
  policyViolationCode?: string;
}

/**
 * Paginated Google review response.
 */
export interface GoogleReviewPage {
  reviews: GoogleReviewData[];
  nextPageToken?: string;
}

/**
 * Review synchronization result.
 */
export interface ReviewSyncResult {
  processed: number;
  created: number;
  updated: number;
  completed: boolean;
  error?: string;
}

/**
 * Provider abstraction for Google Business Profile operations.
 * Isolates Google API HTTP communication from domain business logic.
 */
export interface GoogleBusinessProfileProvider {
  getAuthorizationUrl(params: { state: string; promptConsent?: boolean }): string;
  exchangeAuthorizationCode(code: string): Promise<GoogleOAuthTokens>;
  listAccounts(accessToken: string): Promise<GoogleAccount[]>;
  listLocations(accessToken: string, accountName: string): Promise<GoogleLocation[]>;
  revokeToken?(token: string): Promise<void>;
  listReviews?(params: {
    accessToken: string;
    locationName: string;
    pageToken?: string;
  }): Promise<GoogleReviewPage>;
}
