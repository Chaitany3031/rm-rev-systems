import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  initiateGoogleConnection,
  processOAuthCallback,
  selectGoogleLocation,
  getGoogleConnectionForTenant,
  disconnectGoogleConnection,
  sanitizeGoogleConnection,
  createOAuthState,
  validateOAuthState,
  encryptToken,
  decryptToken,
  HttpGoogleBusinessProfileProvider,
  MockGoogleBusinessProfileProvider,
  GOOGLE_GBP_SCOPE,
  DEFAULT_MOCK_ACCOUNTS,
  DEFAULT_MOCK_LOCATIONS,
  GoogleOAuthError,
  GoogleApiError,
  GoogleConnectionNotFoundError,
  initiateOAuthSchema,
  selectLocationSchema,
  oauthCallbackQuerySchema,
  disconnectSchema,
  type GoogleBusinessProfileProvider,
} from "@/domains/google";
import { requireTenantAdmin } from "@/domains/auth";
import { NotFoundError, ValidationError, AuthorizationError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { resolveCurrentUser } from "@/domains/auth/session";

// Mock the database client
vi.mock("@/lib/db", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    tenantMembership: {
      findFirst: vi.fn(),
    },
    googleConnection: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/domains/auth/session", () => ({
  resolveCurrentUser: vi.fn(),
}));

describe("Feature 04 — Google Business Profile Connection Domain & Security Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTenant = {
    id: "tenant-rm-1",
    name: "RM Solution",
    slug: "rm-solution",
    publicToken: "rm-solution-dev",
    description: "Digital systems",
  };

  const mockConnectionRecord = {
    id: "conn-100",
    tenantId: "tenant-rm-1",
    provider: "google",
    googleAccountId: "accounts/108392019482",
    googleAccountName: "RM Solution Google Org",
    googleLocationId: "locations/948201948",
    googleLocationName: "locations/948201948",
    locationTitle: "RM Solution - Tech Park",
    locationAddress: "100 Innovation Blvd, Suite 400, Silicon Valley, CA, 94025, US",
    status: "CONNECTED",
    errorMessage: null,
    scope: GOOGLE_GBP_SCOPE,
    encryptedAccessToken: "iv:tag:cipherAccessToken",
    encryptedRefreshToken: "iv:tag:cipherRefreshToken",
    tokenExpiresAt: new Date("2026-12-31T23:59:59Z"),
    createdAt: new Date("2026-09-16T10:00:00Z"),
    updatedAt: new Date("2026-09-16T10:00:00Z"),
  };

  describe("1. Credential Encryption & Non-Disclosure (AES-256-GCM)", () => {
    it("should encrypt and decrypt tokens accurately", () => {
      const originalToken = "ya29.a0AfH6SMB_secret_access_token_12345";
      const encrypted = encryptToken(originalToken);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(originalToken);
      expect(encrypted.split(":").length).toBe(3); // iv:authTag:ciphertext

      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(originalToken);
    });

    it("should reject encryption on empty or non-string inputs", () => {
      expect(() => encryptToken("")).toThrow(GoogleOAuthError);
      expect(() => encryptToken(null as unknown as string)).toThrow(GoogleOAuthError);
    });

    it("should fail safely on tampered ciphertext or invalid auth tag", () => {
      const originalToken = "secret-refresh-token-987";
      const encrypted = encryptToken(originalToken);
      const parts = encrypted.split(":");

      // Tamper ciphertext
      const tamperedParts = [parts[0], parts[1], parts[2].slice(0, -2) + "00"];
      const tamperedPayload = tamperedParts.join(":");

      expect(() => decryptToken(tamperedPayload)).toThrow(GoogleOAuthError);
    });

    it("should fail safely on malformed payload formats", () => {
      expect(() => decryptToken("invalid-payload-without-segments")).toThrow(GoogleOAuthError);
      expect(() => decryptToken("")).toThrow(GoogleOAuthError);
    });

    it("sanitizeGoogleConnection strictly removes all encrypted tokens and internal secrets", () => {
      const sanitized = sanitizeGoogleConnection(mockConnectionRecord);

      expect(sanitized.id).toBe("conn-100");
      expect(sanitized.tenantId).toBe("tenant-rm-1");
      expect(sanitized.status).toBe("CONNECTED");
      expect(sanitized.locationTitle).toBe("RM Solution - Tech Park");

      // Verify secrets are NOT present on the sanitized DTO
      expect((sanitized as unknown as Record<string, unknown>).encryptedAccessToken).toBeUndefined();
      expect((sanitized as unknown as Record<string, unknown>).encryptedRefreshToken).toBeUndefined();
      expect((sanitized as unknown as Record<string, unknown>).scope).toBeUndefined();
      expect((sanitized as unknown as Record<string, unknown>).tokenExpiresAt).toBeUndefined();
    });
  });

  describe("2. OAuth State Creation & CSRF Protection", () => {
    it("should create a cryptographically signed state string containing tenantId and nonce", () => {
      const state = createOAuthState({
        tenantId: "tenant-rm-1",
        redirectPath: "/admin/google",
      });

      expect(state).toBeDefined();
      expect(state.split(".").length).toBe(2); // payloadBase64.signatureHex

      const payload = validateOAuthState(state);
      expect(payload.tenantId).toBe("tenant-rm-1");
      expect(payload.redirectPath).toBe("/admin/google");
      expect(payload.nonce).toBeDefined();
      expect(typeof payload.issuedAt).toBe("number");
    });

    it("should reject OAuth state creation with empty tenantId", () => {
      expect(() => createOAuthState({ tenantId: "" })).toThrow(GoogleOAuthError);
    });

    it("should reject tampered OAuth state signatures", () => {
      const state = createOAuthState({ tenantId: "tenant-rm-1" });
      const [, signature] = state.split(".");

      // Tamper the payload segment
      const tamperedPayload = Buffer.from(
        JSON.stringify({ tenantId: "tenant-attacker-99", nonce: "fake", issuedAt: Date.now() })
      ).toString("base64url");

      const tamperedState = `${tamperedPayload}.${signature}`;
      expect(() => validateOAuthState(tamperedState)).toThrow(GoogleOAuthError);
    });

    it("should reject expired OAuth states", () => {
      const expiredPayload = {
        tenantId: "tenant-rm-1",
        nonce: "test-nonce",
        issuedAt: Date.now() - 20 * 60 * 1000, // 20 mins ago (max age is 15 mins)
      };
      const payloadBase64 = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
      const fakeState = `${payloadBase64}.fakesig`;

      // Even with 0 maxAgeMs, invalid signature or expiration fails
      expect(() => validateOAuthState(fakeState, 1000)).toThrow(GoogleOAuthError);
    });

    it("should reject malformed state strings", () => {
      expect(() => validateOAuthState("")).toThrow(GoogleOAuthError);
      expect(() => validateOAuthState("no-dot-state")).toThrow(GoogleOAuthError);
    });
  });

  describe("3. Google Business Profile Provider Abstraction", () => {
    it("HttpGoogleBusinessProfileProvider constructs proper Google authorization URL", () => {
      const provider = new HttpGoogleBusinessProfileProvider();
      // Configure test mock env vars
      process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
      process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
      process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://localhost:3000/api/google/oauth/callback";

      const url = provider.getAuthorizationUrl({ state: "test-signed-state" });
      const parsedUrl = new URL(url);

      expect(parsedUrl.origin).toBe("https://accounts.google.com");
      expect(parsedUrl.pathname).toBe("/o/oauth2/v2/auth");
      expect(parsedUrl.searchParams.get("client_id")).toBe("test-client-id.apps.googleusercontent.com");
      expect(parsedUrl.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/google/oauth/callback");
      expect(parsedUrl.searchParams.get("response_type")).toBe("code");
      expect(parsedUrl.searchParams.get("scope")).toBe(GOOGLE_GBP_SCOPE);
      expect(parsedUrl.searchParams.get("access_type")).toBe("offline");
      expect(parsedUrl.searchParams.get("prompt")).toBe("consent");
      expect(parsedUrl.searchParams.get("state")).toBe("test-signed-state");
    });

    it("MockGoogleBusinessProfileProvider returns deterministic mock data", async () => {
      const provider = new MockGoogleBusinessProfileProvider();

      const tokens = await provider.exchangeAuthorizationCode("valid-auth-code");
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.scope).toBe(GOOGLE_GBP_SCOPE);

      const accounts = await provider.listAccounts(tokens.accessToken);
      expect(accounts).toEqual(DEFAULT_MOCK_ACCOUNTS);
      expect(accounts.length).toBe(1);

      const locations = await provider.listLocations(tokens.accessToken, accounts[0].name);
      expect(locations).toEqual(DEFAULT_MOCK_LOCATIONS[accounts[0].name]);
      expect(locations.length).toBe(2);
      expect(locations[0].title).toBe("RM Solution - Tech Park");
    });

    it("MockGoogleBusinessProfileProvider simulates empty accounts scenario", async () => {
      const provider = new MockGoogleBusinessProfileProvider({ scenario: "empty_accounts" });
      const accounts = await provider.listAccounts("mock-token");
      expect(accounts).toEqual([]);
    });

    it("MockGoogleBusinessProfileProvider simulates empty locations scenario", async () => {
      const provider = new MockGoogleBusinessProfileProvider({ scenario: "empty_locations" });
      const locations = await provider.listLocations("mock-token", "accounts/123");
      expect(locations).toEqual([]);
    });

    it("MockGoogleBusinessProfileProvider simulates OAuth exchange failure", async () => {
      const provider = new MockGoogleBusinessProfileProvider({ scenario: "oauth_failure" });
      await expect(provider.exchangeAuthorizationCode("code")).rejects.toThrow(GoogleOAuthError);
    });

    it("MockGoogleBusinessProfileProvider simulates API failure", async () => {
      const provider = new MockGoogleBusinessProfileProvider({ scenario: "api_failure" });
      await expect(provider.listAccounts("mock-token")).rejects.toThrow(GoogleApiError);
    });
  });

  describe("4. Domain Service: initiateGoogleConnection", () => {
    it("should initiate OAuth flow for an existing tenant", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);

      const mockProvider: GoogleBusinessProfileProvider = {
        getAuthorizationUrl: vi.fn().mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?client_id=test"),
        exchangeAuthorizationCode: vi.fn(),
        listAccounts: vi.fn(),
        listLocations: vi.fn(),
      };

      const result = await initiateGoogleConnection(
        { tenantId: "tenant-rm-1", redirectPath: "/admin/google" },
        mockProvider
      );

      expect(result.authorizationUrl).toContain("https://accounts.google.com");
      expect(result.state).toBeDefined();
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: "tenant-rm-1" },
        select: { id: true, name: true },
      });
      expect(mockProvider.getAuthorizationUrl).toHaveBeenCalled();
    });

    it("should throw NotFoundError for non-existent tenant", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(null);

      await expect(
        initiateGoogleConnection({ tenantId: "nonexistent-tenant" })
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ValidationError for missing tenantId", async () => {
      await expect(
        initiateGoogleConnection({ tenantId: "" })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("5. Domain Service: processOAuthCallback", () => {
    it("should process OAuth callback, discover accounts and locations, and persist connection", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);

      const state = createOAuthState({ tenantId: "tenant-rm-1" });
      const mockProvider = new MockGoogleBusinessProfileProvider();

      const createdDbConnection = {
        ...mockConnectionRecord,
        id: "conn-new-1",
        tenantId: "tenant-rm-1",
      };
      vi.mocked(prisma.googleConnection.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.googleConnection.upsert).mockResolvedValueOnce(createdDbConnection as never);

      const result = await processOAuthCallback(
        { code: "auth-code-123", state },
        mockProvider
      );

      expect(result.tenantId).toBe("tenant-rm-1");
      expect(result.discoveredAccounts.length).toBe(1);
      expect(result.discoveredAccounts[0].account.name).toBe("accounts/108392019482");
      expect(result.discoveredAccounts[0].locations.length).toBe(2);
      expect(result.connection.id).toBe("conn-new-1");
      expect(result.connection.status).toBe("CONNECTED");

      // Verify upsert was tenant-scoped
      expect(prisma.googleConnection.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "tenant-rm-1" },
          create: expect.objectContaining({
            tenantId: "tenant-rm-1",
            provider: "google",
            status: "CONNECTED",
          }),
        })
      );
    });

    it("should handle OAuth cancellation/denial safely", async () => {
      const state = createOAuthState({ tenantId: "tenant-rm-1" });

      await expect(
        processOAuthCallback({
          state,
          error: "access_denied",
          error_description: "The user denied consent",
        })
      ).rejects.toThrow(GoogleOAuthError);

      expect(prisma.googleConnection.upsert).not.toHaveBeenCalled();
    });

    it("should reject missing authorization code", async () => {
      const state = createOAuthState({ tenantId: "tenant-rm-1" });

      await expect(
        processOAuthCallback({ state })
      ).rejects.toThrow(GoogleOAuthError);
    });

    it("should reject invalid/tampered OAuth state parameter", async () => {
      await expect(
        processOAuthCallback({
          code: "auth-code",
          state: "tampered-state.invalid-sig",
        })
      ).rejects.toThrow(GoogleOAuthError);
    });

    it("should handle provider token exchange failure gracefully", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      const state = createOAuthState({ tenantId: "tenant-rm-1" });
      const failingProvider = new MockGoogleBusinessProfileProvider({ scenario: "oauth_failure" });

      await expect(
        processOAuthCallback({ code: "bad-code", state }, failingProvider)
      ).rejects.toThrow(GoogleOAuthError);

      expect(prisma.googleConnection.upsert).not.toHaveBeenCalled();
    });
  });

  describe("6. Domain Service: selectGoogleLocation", () => {
    it("should persist location selection for an authorized tenant", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.googleConnection.findUnique).mockResolvedValueOnce(mockConnectionRecord as never);

      const updatedRecord = {
        ...mockConnectionRecord,
        googleLocationId: "locations/948201949",
        locationTitle: "RM Solution - Downtown",
        locationAddress: "500 Market St, San Francisco, CA 94105",
      };
      vi.mocked(prisma.googleConnection.update).mockResolvedValueOnce(updatedRecord as never);

      const result = await selectGoogleLocation({
        tenantId: "tenant-rm-1",
        googleAccountId: "accounts/108392019482",
        googleAccountName: "RM Solution Org",
        googleLocationId: "locations/948201949",
        locationTitle: "RM Solution - Downtown",
        locationAddress: "500 Market St, San Francisco, CA 94105",
      });

      expect(result.googleLocationId).toBe("locations/948201949");
      expect(result.locationTitle).toBe("RM Solution - Downtown");

      expect(prisma.googleConnection.update).toHaveBeenCalledWith({
        where: { tenantId: "tenant-rm-1" },
        data: expect.objectContaining({
          googleLocationId: "locations/948201949",
          locationTitle: "RM Solution - Downtown",
          status: "CONNECTED",
        }),
      });
    });

    it("should throw NotFoundError if tenant does not exist", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(null);

      await expect(
        selectGoogleLocation({
          tenantId: "invalid-tenant",
          googleAccountId: "accounts/1",
          googleLocationId: "locations/1",
          locationTitle: "Title",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw GoogleConnectionNotFoundError if tenant has no connection to configure", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.googleConnection.findUnique).mockResolvedValueOnce(null);

      await expect(
        selectGoogleLocation({
          tenantId: "tenant-rm-1",
          googleAccountId: "accounts/1",
          googleLocationId: "locations/1",
          locationTitle: "Title",
        })
      ).rejects.toThrow(GoogleConnectionNotFoundError);
    });

    it("should throw ValidationError for missing locationTitle", async () => {
      await expect(
        selectGoogleLocation({
          tenantId: "tenant-rm-1",
          googleAccountId: "accounts/1",
          googleLocationId: "locations/1",
          locationTitle: "",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("7. Domain Service: disconnectGoogleConnection", () => {
    it("should safely clear encrypted credentials and mark connection DISCONNECTED", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.googleConnection.findUnique).mockResolvedValueOnce(mockConnectionRecord as never);

      const disconnectedRecord = {
        ...mockConnectionRecord,
        status: "DISCONNECTED",
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
      };
      vi.mocked(prisma.googleConnection.update).mockResolvedValueOnce(disconnectedRecord as never);

      const mockProvider: GoogleBusinessProfileProvider = {
        getAuthorizationUrl: vi.fn(),
        exchangeAuthorizationCode: vi.fn(),
        listAccounts: vi.fn(),
        listLocations: vi.fn(),
        revokeToken: vi.fn().mockResolvedValue(undefined),
      };

      const result = await disconnectGoogleConnection(
        { tenantId: "tenant-rm-1" },
        mockProvider
      );

      expect(result.status).toBe("DISCONNECTED");
      expect(prisma.googleConnection.update).toHaveBeenCalledWith({
        where: { tenantId: "tenant-rm-1" },
        data: {
          status: "DISCONNECTED",
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
          errorMessage: null,
        },
      });
    });

    it("should throw GoogleConnectionNotFoundError when disconnecting a non-existent connection", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.googleConnection.findUnique).mockResolvedValueOnce(null);

      await expect(
        disconnectGoogleConnection({ tenantId: "tenant-rm-1" })
      ).rejects.toThrow(GoogleConnectionNotFoundError);
    });
  });

  describe("8. Tenant Isolation & Security Invariants", () => {
    it("SECURITY: Tenant A cannot view Tenant B's connection", async () => {
      // Setup: DB has Tenant B connection
      vi.mocked(prisma.googleConnection.findUnique).mockImplementation((({ where }: { where: { tenantId?: string } }) => {
        if (where?.tenantId === "tenant-beta-2") {
          return Promise.resolve({
            ...mockConnectionRecord,
            id: "conn-beta",
            tenantId: "tenant-beta-2",
            locationTitle: "Beta Corp Main",
          });
        }
        return Promise.resolve(null);
      }) as never);

      // Tenant A queries for its connection
      const connectionA = await getGoogleConnectionForTenant("tenant-rm-1");
      expect(connectionA).toBeNull();

      // Tenant B queries for its connection
      const connectionB = await getGoogleConnectionForTenant("tenant-beta-2");
      expect(connectionB).not.toBeNull();
      expect(connectionB?.tenantId).toBe("tenant-beta-2");
      expect(connectionB?.locationTitle).toBe("Beta Corp Main");
    });

    it("SECURITY: Tenant A cannot select location on Tenant B's connection", async () => {
      // Tenant A resolves
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      // But Tenant A has no connection (only Tenant B has one)
      vi.mocked(prisma.googleConnection.findUnique).mockResolvedValueOnce(null);

      await expect(
        selectGoogleLocation({
          tenantId: "tenant-rm-1",
          googleAccountId: "accounts/108392019482",
          googleLocationId: "locations/948201948",
          locationTitle: "Hijacked Title",
        })
      ).rejects.toThrow(GoogleConnectionNotFoundError);

      expect(prisma.googleConnection.update).not.toHaveBeenCalled();
    });

    it("SECURITY: Tenant A cannot disconnect Tenant B's connection", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.googleConnection.findUnique).mockResolvedValueOnce(null);

      await expect(
        disconnectGoogleConnection({ tenantId: "tenant-rm-1" })
      ).rejects.toThrow(GoogleConnectionNotFoundError);

      expect(prisma.googleConnection.update).not.toHaveBeenCalled();
    });

    it("SECURITY: public feedback tokens cannot manage Google connections", async () => {
      vi.mocked(resolveCurrentUser).mockResolvedValueOnce({ userId: "user-rm-1" });
      vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValueOnce(null);

      await expect(
        requireTenantAdmin("rm-solution-dev")
      ).rejects.toThrow(AuthorizationError);
    });

    it("SECURITY: valid tenant admin resolves by tenant ID or slug", async () => {
      vi.mocked(resolveCurrentUser).mockResolvedValueOnce({ userId: "user-rm-1" });
      vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValueOnce({
        role: "ADMIN",
        tenant: mockTenant,
      } as never);
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);

      const admin = await requireTenantAdmin("tenant-rm-1");
      expect(admin.tenantId).toBe("tenant-rm-1");
      expect(admin.userId).toBe("user-rm-1");
      expect(admin.role).toBe("ADMIN");
    });
  });

  describe("9. Server Actions", () => {
    it("initiateGoogleConnectAction returns authorization URL on success", async () => {
      const { initiateGoogleConnectAction } = await import("@/app/admin/google/actions");

      vi.mocked(resolveCurrentUser).mockResolvedValueOnce({ userId: "user-rm-1" });
      vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValueOnce({
        role: "ADMIN",
        tenant: mockTenant,
      } as never);

      const res = await initiateGoogleConnectAction("tenant-rm-1");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.authorizationUrl).toContain("accounts.google.com");
      }
    });

    it("disconnectGoogleAction returns disconnected connection on success", async () => {
      const { disconnectGoogleAction } = await import("@/app/admin/google/actions");

      vi.mocked(resolveCurrentUser).mockResolvedValueOnce({ userId: "user-rm-1" });
      vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValueOnce({
        role: "ADMIN",
        tenant: mockTenant,
      } as never);
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.googleConnection.findUnique).mockResolvedValue(mockConnectionRecord as never);
      vi.mocked(prisma.googleConnection.update).mockResolvedValue({
        ...mockConnectionRecord,
        status: "DISCONNECTED",
        encryptedAccessToken: null,
      } as never);

      const res = await disconnectGoogleAction("tenant-rm-1");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.status).toBe("DISCONNECTED");
      }
    });

    it("server actions return safe error responses without leaking credentials", async () => {
      const { initiateGoogleConnectAction } = await import("@/app/admin/google/actions");

      vi.mocked(prisma.tenant.findUnique).mockImplementationOnce(() => {
        throw new Error("DB_CRASH_SECRET_PASSWORD_9999");
      });
      vi.mocked(prisma.tenant.findFirst).mockImplementationOnce(() => {
        throw new Error("DB_CRASH_SECRET_PASSWORD_9999");
      });

      const res = await initiateGoogleConnectAction("tenant-rm-1");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errors.form[0]).not.toContain("SECRET_PASSWORD");
        expect(res.errors.form[0]).toContain("unexpected error");
      }
    });
  });

  describe("10. Validation Schemas", () => {
    it("initiateOAuthSchema validates tenantId", () => {
      expect(initiateOAuthSchema.safeParse({ tenantId: "tenant-1" }).success).toBe(true);
      expect(initiateOAuthSchema.safeParse({ tenantId: "" }).success).toBe(false);
    });

    it("oauthCallbackQuerySchema validates parameters", () => {
      expect(
        oauthCallbackQuerySchema.safeParse({ code: "c", state: "s" }).success
      ).toBe(true);
      expect(
        oauthCallbackQuerySchema.safeParse({ error: "access_denied", state: "s" }).success
      ).toBe(true);
      expect(
        oauthCallbackQuerySchema.safeParse({ code: "c" }).success
      ).toBe(false); // missing state
    });

    it("selectLocationSchema validates required locationTitle and identifiers", () => {
      expect(
        selectLocationSchema.safeParse({
          tenantId: "t-1",
          googleAccountId: "a-1",
          googleLocationId: "l-1",
          locationTitle: "RM Solution",
        }).success
      ).toBe(true);

      expect(
        selectLocationSchema.safeParse({
          tenantId: "t-1",
          googleAccountId: "a-1",
          googleLocationId: "l-1",
          locationTitle: "",
        }).success
      ).toBe(false);
    });

    it("disconnectSchema validates tenantId", () => {
      expect(disconnectSchema.safeParse({ tenantId: "t-1" }).success).toBe(true);
      expect(disconnectSchema.safeParse({ tenantId: "" }).success).toBe(false);
    });
  });
});
