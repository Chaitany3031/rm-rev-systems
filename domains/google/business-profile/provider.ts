import { getEnvConfig } from "@/lib/env";
import { GoogleOAuthError, GoogleApiError } from "../errors";
import type {
  GoogleBusinessProfileProvider,
  GoogleOAuthTokens,
  GoogleAccount,
  GoogleLocation,
  GoogleReviewData,
} from "../types";

export const GOOGLE_GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_ACCOUNTS_ENDPOINT = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const GOOGLE_LOCATIONS_BASE_ENDPOINT = "https://mybusinessbusinessinformation.googleapis.com/v1";
const GOOGLE_REVIEWS_BASE_ENDPOINT = "https://mybusinessaccountmanagement.googleapis.com/v1";
const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export interface HttpProviderOptions {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

/**
 * Concrete HTTP Provider communicating with real Google OAuth and Google Business Profile APIs.
 */
export class HttpGoogleBusinessProfileProvider implements GoogleBusinessProfileProvider {
  private options?: HttpProviderOptions;

  constructor(options?: HttpProviderOptions) {
    this.options = options;
  }

  private getClientId(): string {
    if (this.options?.clientId) return this.options.clientId;
    if (process.env.GOOGLE_CLIENT_ID) return process.env.GOOGLE_CLIENT_ID;
    const env = getEnvConfig();
    if (!env.GOOGLE_CLIENT_ID) {
      throw new GoogleOAuthError("GOOGLE_CLIENT_ID is not configured in environment");
    }
    return env.GOOGLE_CLIENT_ID;
  }

  private getClientSecret(): string {
    if (this.options?.clientSecret) return this.options.clientSecret;
    if (process.env.GOOGLE_CLIENT_SECRET) return process.env.GOOGLE_CLIENT_SECRET;
    const env = getEnvConfig();
    if (!env.GOOGLE_CLIENT_SECRET) {
      throw new GoogleOAuthError("GOOGLE_CLIENT_SECRET is not configured in environment");
    }
    return env.GOOGLE_CLIENT_SECRET;
  }

  private getRedirectUri(): string {
    if (this.options?.redirectUri) return this.options.redirectUri;
    if (process.env.GOOGLE_OAUTH_REDIRECT_URI) return process.env.GOOGLE_OAUTH_REDIRECT_URI;
    const env = getEnvConfig();
    if (!env.GOOGLE_OAUTH_REDIRECT_URI) {
      const appUrl = env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return `${appUrl.replace(/\/$/, "")}/api/google/oauth/callback`;
    }
    return env.GOOGLE_OAUTH_REDIRECT_URI;
  }

  public getAuthorizationUrl(params: { state: string; promptConsent?: boolean }): string {
    const clientId = this.getClientId();
    const redirectUri = this.getRedirectUri();

    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_GBP_SCOPE,
      access_type: "offline",
      include_granted_scopes: "true",
      state: params.state,
    });

    if (params.promptConsent !== false) {
      query.set("prompt", "consent");
    }

    return `${GOOGLE_AUTH_ENDPOINT}?${query.toString()}`;
  }

  public async exchangeAuthorizationCode(code: string): Promise<GoogleOAuthTokens> {
    if (!code || typeof code !== "string" || code.trim() === "") {
      throw new GoogleOAuthError("Missing authorization code for token exchange");
    }

    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = this.getRedirectUri();

    try {
      const body = new URLSearchParams({
        code: code.trim(),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      });

      const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          (errorData as { error_description?: string; error?: string }).error_description ||
          (errorData as { error?: string }).error ||
          `Google token exchange failed with status ${response.status}`;
        throw new GoogleOAuthError(message);
      }

      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        scope: data.scope,
        tokenType: data.token_type || "Bearer",
      };
    } catch (err) {
      if (err instanceof GoogleOAuthError) {
        throw err;
      }
      throw new GoogleOAuthError("Network or provider failure during Google token exchange", {
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  public async listAccounts(accessToken: string): Promise<GoogleAccount[]> {
    if (!accessToken) {
      throw new GoogleApiError("Access token is required to list Google accounts");
    }

    try {
      const response = await fetch(GOOGLE_ACCOUNTS_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new GoogleApiError("Google access token has expired or is unauthorized", 401);
        }
        if (response.status === 403) {
          throw new GoogleApiError(
            "Access to Google Business Profile API was denied. Ensure Business Profile API is enabled and approved for your Google Cloud Project.",
            403
          );
        }
        throw new GoogleApiError(
          `Google Business Profile accounts API returned status ${response.status}`,
          response.status
        );
      }

      const data = (await response.json()) as { accounts?: GoogleAccount[] };
      return data.accounts || [];
    } catch (err) {
      if (err instanceof GoogleApiError) {
        throw err;
      }
      throw new GoogleApiError("Network or provider failure while discovering Google accounts", undefined, {
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  public async listLocations(accessToken: string, accountName: string): Promise<GoogleLocation[]> {
    if (!accessToken) {
      throw new GoogleApiError("Access token is required to list Google locations");
    }
    if (!accountName) {
      throw new GoogleApiError("Account resource name is required to list Google locations");
    }

    // Official endpoint: https://mybusinessbusinessinformation.googleapis.com/v1/{accountName}/locations
    // with readMask specifying fields
    const readMask = "name,title,storefrontAddress,websiteUri,phoneNumbers";
    const url = `${GOOGLE_LOCATIONS_BASE_ENDPOINT}/${accountName}/locations?readMask=${encodeURIComponent(readMask)}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new GoogleApiError("Google access token has expired or is unauthorized", 401);
        }
        if (response.status === 403) {
          throw new GoogleApiError(
            "Access to Google Business Profile locations was denied. Ensure the authorized account has permissions for these locations.",
            403
          );
        }
        throw new GoogleApiError(
          `Google Business Profile locations API returned status ${response.status}`,
          response.status
        );
      }

      const data = (await response.json()) as { locations?: GoogleLocation[] };
      return data.locations || [];
    } catch (err) {
      if (err instanceof GoogleApiError) {
        throw err;
      }
      throw new GoogleApiError("Network or provider failure while discovering Google locations", undefined, {
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  public async revokeToken(token: string): Promise<void> {
    if (!token) return;

    try {
      await fetch(`${GOOGLE_REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
    } catch {
      // Best-effort token revocation
    }
  }

  public async listReviews(params: {
    accessToken: string;
    locationName: string;
    pageToken?: string;
  }): Promise<{ reviews: GoogleReviewData[]; nextPageToken?: string }> {
    if (!params.accessToken) {
      throw new GoogleApiError("Access token is required to list Google reviews");
    }
    if (!params.locationName) {
      throw new GoogleApiError("Location resource name is required to list reviews");
    }

    const url = new URL(`${GOOGLE_REVIEWS_BASE_ENDPOINT}/${params.locationName}/reviews`);
    if (params.pageToken) {
      url.searchParams.set("pageToken", params.pageToken);
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new GoogleApiError("Google access token has expired or is unauthorized", 401);
        }
        if (response.status === 403) {
          throw new GoogleApiError(
            "Access to Google Business Profile reviews was denied. Ensure the authorized account has permissions for this location.",
            403
          );
        }
        throw new GoogleApiError(
          `Google Business Profile reviews API returned status ${response.status}`,
          response.status
        );
      }

      const data = (await response.json()) as {
        reviews?: Array<{
          name: string;
          reviewer?: { displayName?: string };
          starRating?: string;
          comment?: string;
          createTime?: string;
          updateTime?: string;
          reply?: {
            comment?: string;
            updateTime?: string;
            reviewReplyUrl?: string;
            state?: string;
          };
          reviewerEmail?: string;
          policyCompliant?: boolean;
          policyViolationCode?: string;
        }>;
        nextPageToken?: string;
      };

      const reviews = (data.reviews || []).map((rev) => ({
        googleReviewName: rev.name,
        googleLocationName: params.locationName,
        reviewerDisplayName: rev.reviewer?.displayName,
        starRating: rev.starRating ? parseInt(rev.starRating, 10) : undefined,
        comment: rev.comment,
        reviewCreateTime: rev.createTime ? new Date(rev.createTime) : undefined,
        reviewUpdateTime: rev.updateTime ? new Date(rev.updateTime) : undefined,
        replyComment: rev.reply?.comment,
        replyUpdateTime: rev.reply?.updateTime ? new Date(rev.reply.updateTime) : undefined,
        reviewReplyUrl: rev.reply?.reviewReplyUrl,
        replyState: rev.reply?.state,
        policyViolationCode: rev.policyViolationCode,
      }));

      return {
        reviews,
        nextPageToken: data.nextPageToken,
      };
    } catch (err) {
      if (err instanceof GoogleApiError) {
        throw err;
      }
      throw new GoogleApiError("Network or provider failure while fetching Google reviews", undefined, {
        cause: err instanceof Error ? err : undefined,
      });
    }
  }
}

/**
 * Deterministic Mock Provider for local development and automated testing.
 * Does NOT require live Google credentials or Google Cloud Business Profile API approval.
 */
export interface MockProviderOptions {
  scenario?: "success" | "empty_accounts" | "empty_locations" | "oauth_failure" | "api_failure";
  accounts?: GoogleAccount[];
  locationsByAccount?: Record<string, GoogleLocation[]>;
  redirectUri?: string;
}

export const DEFAULT_MOCK_ACCOUNTS: GoogleAccount[] = [
  {
    name: "accounts/108392019482",
    accountName: "RM Solution Google Org",
    type: "ORGANIZATION",
    verificationState: "VERIFIED",
    vettedState: "VETTED",
  },
];

export const DEFAULT_MOCK_LOCATIONS: Record<string, GoogleLocation[]> = {
  "accounts/108392019482": [
    {
      name: "locations/948201948",
      title: "RM Solution - Tech Park",
      storefrontAddress: {
        addressLines: ["100 Innovation Blvd", "Suite 400"],
        locality: "Silicon Valley",
        administrativeArea: "CA",
        postalCode: "94025",
        regionCode: "US",
      },
      websiteUri: "https://rmsolution.example.com",
      phoneNumbers: { primaryPhone: "+1-555-019-2834" },
    },
    {
      name: "locations/948201949",
      title: "RM Solution - Downtown",
      storefrontAddress: {
        addressLines: ["500 Market St"],
        locality: "San Francisco",
        administrativeArea: "CA",
        postalCode: "94105",
        regionCode: "US",
      },
      websiteUri: "https://rmsolution.example.com/downtown",
      phoneNumbers: { primaryPhone: "+1-555-019-5678" },
    },
  ],
};

export class MockGoogleBusinessProfileProvider implements GoogleBusinessProfileProvider {
  private options: MockProviderOptions;

  constructor(options: MockProviderOptions = {}) {
    this.options = options;
  }

  public getAuthorizationUrl(params: { state: string; promptConsent?: boolean }): string {
    const redirectUri = this.options.redirectUri || "http://localhost:3000/api/google/oauth/callback";
    const query = new URLSearchParams({
      client_id: "mock-google-client-id.apps.googleusercontent.com",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_GBP_SCOPE,
      access_type: "offline",
      state: params.state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
  }

  public async exchangeAuthorizationCode(code: string): Promise<GoogleOAuthTokens> {
    if (this.options.scenario === "oauth_failure") {
      throw new GoogleOAuthError("Simulated OAuth authorization code exchange failure");
    }

    if (!code || code === "invalid_code") {
      throw new GoogleOAuthError("Invalid authorization code provided to mock provider");
    }

    return {
      accessToken: `mock-access-token-${Date.now()}`,
      refreshToken: `mock-refresh-token-${Date.now()}`,
      expiresIn: 3600,
      scope: GOOGLE_GBP_SCOPE,
      tokenType: "Bearer",
    };
  }

  public async listAccounts(accessToken: string): Promise<GoogleAccount[]> {
    if (this.options.scenario === "api_failure") {
      throw new GoogleApiError("Simulated Google API failure while listing accounts", 500);
    }
    if (this.options.scenario === "empty_accounts") {
      return [];
    }
    if (!accessToken || accessToken === "invalid_token") {
      throw new GoogleApiError("Invalid access token", 401);
    }

    return this.options.accounts || DEFAULT_MOCK_ACCOUNTS;
  }

  public async listLocations(accessToken: string, accountName: string): Promise<GoogleLocation[]> {
    if (this.options.scenario === "api_failure") {
      throw new GoogleApiError("Simulated Google API failure while listing locations", 500);
    }
    if (this.options.scenario === "empty_locations") {
      return [];
    }
    if (!accessToken || accessToken === "invalid_token") {
      throw new GoogleApiError("Invalid access token", 401);
    }

    const mapping = this.options.locationsByAccount || DEFAULT_MOCK_LOCATIONS;
    return mapping[accountName] || [];
  }

  public async revokeToken(): Promise<void> {
    // No-op for mock provider
  }

  public async listReviews(params: {
    accessToken: string;
    locationName: string;
    pageToken?: string;
  }): Promise<{ reviews: GoogleReviewData[]; nextPageToken?: string }> {
    if (this.options.scenario === "api_failure") {
      throw new GoogleApiError("Simulated Google API failure while listing reviews", 500);
    }
    if (!params.accessToken || params.accessToken === "invalid_token") {
      throw new GoogleApiError("Invalid access token", 401);
    }

    // Mock reviews for testing
    const mockReviews: GoogleReviewData[] = [
      {
        googleReviewName: "accounts/108392019482/locations/948201948/reviews/review-1",
        googleLocationName: params.locationName,
        reviewerDisplayName: "John Smith",
        starRating: 5,
        comment: "Great service, highly recommend RM Solution for web development.",
        reviewCreateTime: new Date("2026-09-10T10:00:00Z"),
        reviewUpdateTime: new Date("2026-09-10T10:00:00Z"),
      },
      {
        googleReviewName: "accounts/108392019482/locations/948201948/reviews/review-2",
        googleLocationName: params.locationName,
        reviewerDisplayName: "Jane Doe",
        starRating: 4,
        comment: "Good experience with the AI chatbot implementation. Support was responsive.",
        reviewCreateTime: new Date("2026-09-12T14:30:00Z"),
        reviewUpdateTime: new Date("2026-09-12T14:30:00Z"),
        replyComment: "Thank you for the feedback!",
        replyUpdateTime: new Date("2026-09-13T08:00:00Z"),
        replyState: "PUBLISHED",
      },
    ];

    // Support pagination
    const pageSize = 2;
    const pageIndex = params.pageToken ? parseInt(params.pageToken, 10) : 0;
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    const pageReviews = mockReviews.slice(start, end);
    const hasMore = end < mockReviews.length;

    return {
      reviews: pageReviews,
      nextPageToken: hasMore ? String(pageIndex + 1) : undefined,
    };
  }
}
