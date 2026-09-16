# Feature 04 — Google Business Profile Connection

## 1. Purpose

Implement the first Google Business Profile integration boundary for RM Rev Systems.

The goal of this feature is to allow an authenticated tenant administrator to connect their Google Business Profile account through OAuth 2.0 and persist the minimum information required to establish a tenant-scoped Google Business Profile connection.

This feature establishes the Google integration architecture for future features.

It must NOT implement:

* Google review synchronization
* Google review replies
* AI-generated Google replies
* automatic review replies
* automatic review publishing
* Pub/Sub notifications
* Google review inbox
* analytics
* billing
* microservices

Those belong to later features.

## 2. Product Flow

Future intended architecture:

Tenant Admin
↓
Connect Google Business Profile
↓
Google OAuth 2.0
↓
Google consent
↓
OAuth callback
↓
Exchange authorization code
↓
Secure server-side credential storage
↓
Discover Google Business Profile accounts
↓
Discover locations
↓
Admin selects the intended location
↓
Persist tenant-scoped connection
↓
Connection shown as active

Feature 04 only needs to establish the connection and selected account/location boundary.

## 3. Official Google Requirements

Use Google's official Business Profile APIs and OAuth documentation as the source of truth.

Relevant OAuth scope:

`https://www.googleapis.com/auth/business.manage`

Google Business Profile API access is subject to Google's eligibility and approval requirements.

Do not assume that having a Google Cloud OAuth client automatically grants Business Profile API access.

Do not fabricate unsupported endpoints or capabilities.

Before implementing any Google API request, verify the current official Google documentation.

Official references:

* Business Profile API overview
* Business Profile API prerequisites
* Business Profile API basic setup
* OAuth overview/setup
* Account management
* Location management

## 4. Architecture

Google integration must remain a dedicated bounded context.

Recommended structure:

domains/
└── google/
├── types.ts
├── errors.ts
├── oauth/
│   ├── service.ts
│   └── provider.ts
├── business-profile/
│   ├── provider.ts
│   ├── service.ts
│   └── types.ts
└── index.ts

Do not place Google API calls inside:

* React components
* server components
* generic lib utilities
* AI services
* feedback services
* review generation services

Application routes/actions should be thin entry points.

The domain layer owns business logic.

## 5. Provider Abstraction

Create an abstraction around Google Business Profile operations.

Example conceptual interface:

```ts
interface GoogleBusinessProfileProvider {
  exchangeAuthorizationCode(...): Promise<...>;
  listAccounts(...): Promise<...>;
  listLocations(...): Promise<...>;
}
```

The exact interface should follow the actual Google API behavior discovered during implementation.

Do not over-design the interface for future features.

Only expose operations required by Feature 04.

The rest of the application must depend on the abstraction rather than directly on Google's HTTP API.

## 6. OAuth Requirements

OAuth must be handled server-side.

The browser may initiate OAuth, but:

* client secrets must never reach the browser
* access tokens must never be exposed to browser JavaScript
* refresh tokens must never be exposed to browser JavaScript
* Google credentials must never be passed to the AI provider
* authorization codes must only be processed server-side

Use a server-side callback route.

Use an explicit OAuth `state` mechanism to protect the callback against CSRF.

The state must not contain sensitive credentials.

Validate the OAuth callback before exchanging the authorization code.

Handle:

* missing code
* OAuth denial
* invalid state
* expired/invalid state
* token exchange failure
* Google API failure

without leaking secrets or raw provider responses.

## 7. Environment Variables

Use server-only environment variables for Google credentials.

Expected configuration should be documented, but do not hardcode actual values.

Examples:

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=
```

Use the project's existing environment validation architecture.

Do not expose these through `NEXT_PUBLIC_*`.

Do not commit credentials.

Do not add fake production credentials.

If the project already has Google environment variables, inspect and reuse them rather than creating unnecessary duplicates.

## 8. Database Model

Introduce a tenant-scoped Google Business Profile connection model.

The exact schema should be designed based on the existing Prisma schema.

Conceptually it should contain only what Feature 04 needs, such as:

* id
* tenantId
* provider
* Google account identifier
* Google location identifier, if selected
* display/business metadata required by the UI
* encrypted credential material or secure credential references
* connection status
* createdAt
* updatedAt

The model must have a tenant relation.

Tenant isolation must be enforced at the domain-service level.

Do not store unnecessary Google profile data.

Do not store raw OAuth authorization codes.

Do not store client secrets in the database.

## 9. Credential Security

OAuth credentials are highly sensitive.

The implementation must establish a secure storage boundary.

Preferred architecture:

Application domain
↓
Credential service
↓
Encrypted persistence

If the existing project does not yet have a production-grade encryption/key-management mechanism, do NOT invent a fake security implementation and call it production-ready.

Instead:

1. identify the missing security dependency,
2. document it as an explicit implementation requirement/open question,
3. create the smallest safe abstraction,
4. never log raw access or refresh tokens.

Never:

```ts
console.log(accessToken);
console.log(refreshToken);
```

Never return tokens from API responses.

Never place tokens in URLs.

Never place tokens in client state.

Never send tokens to an AI model.

## 10. Tenant Isolation

Every persisted Google connection belongs to exactly one tenant.

A connection must never be retrievable or modifiable solely by a Google account ID, location ID, or connection ID without tenant authorization.

Domain operations should follow:

authenticated application user
↓
resolved tenant
↓
tenant-scoped Google connection

Add tests proving that one tenant cannot access another tenant's Google connection.

## 11. Authentication Boundary

Feature 04 is an administrative feature.

Do not expose Google connection management through the public customer feedback route.

The existing public feedback token must NOT be sufficient to manage a Google Business Profile connection.

Use the project's existing authenticated admin/user boundary if it exists.

If the project does not yet have a complete admin authentication system, do not invent an unrelated authentication system just to complete Feature 04.

Instead, identify the existing authentication boundary and document the missing prerequisite.

## 12. Google Account Discovery

After OAuth succeeds, the server should be able to discover the Google Business Profile accounts available to the authorized Google user, subject to the permissions granted by Google.

Then retrieve available locations for the selected account.

Do not assume:

* one Google account equals one business
* one account equals one location
* the first location returned is the correct location
* RM Solution is automatically the selected location

The administrator must explicitly select the intended location where multiple choices exist.

Google's documentation confirms that API access does not automatically grant access to arbitrary Business Profiles; the authorized Google user must have access to the relevant profile.

## 13. Selection UI

Provide an administrative connection flow that can show:

### Step 1

"Connect Google Business Profile"

Explain briefly why the connection is required.

### Step 2

Google OAuth.

### Step 3

Show available Business Profile accounts/locations.

### Step 4

Allow the administrator to select the intended location.

### Step 5

Persist the connection.

### Step 6

Show connection status.

The UI must include:

* loading state
* OAuth error state
* empty accounts state
* empty locations state
* API error state
* successful connection state
* already-connected state

Do not expose raw Google API error payloads to users.

## 14. Connection Status

Use an explicit connection state rather than relying only on the existence of a database row.

Possible states can include:

```text
CONNECTED
DISCONNECTED
ERROR
```

Only add additional states if implementation evidence requires them.

## 15. Disconnect

If a disconnect operation is included in Feature 04, it must:

* be tenant-scoped
* remove/deactivate the connection safely
* never expose credentials
* require an authenticated administrator

Do not assume that local deletion automatically revokes Google's OAuth authorization.

If Google authorization revocation is implemented, verify the official Google documentation first.

Otherwise keep local disconnect separate from Google's authorization lifecycle.

## 16. No AI

Feature 04 must not call the AI provider.

No AI prompt.

No AI-generated content.

No review generation.

No review reply generation.

## 17. No Google Reviews Yet

Do not implement:

* review list
* review synchronization
* review replies
* review reply publishing
* Pub/Sub review notifications

The Google review API will be introduced in a later feature.

Google's current documentation confirms that review operations are available through dedicated Business Profile API functionality, but that is outside this feature's scope.

## 18. Testing

Add focused tests for:

### OAuth

* valid OAuth initiation
* state generation
* state validation
* rejected/missing state
* OAuth denial
* token exchange failure

### Tenant isolation

* tenant A cannot access tenant B's connection
* tenant A cannot modify tenant B's connection

### Provider boundary

* Google provider is called through the abstraction
* raw provider implementation is not required by unrelated domains

### Account/location selection

* accounts returned successfully
* no accounts
* locations returned successfully
* no locations
* invalid selected location
* selected location belongs to discovered account

### Persistence

* connection belongs to tenant
* selected Google identifiers persist correctly
* duplicate connection behavior is deterministic

### Security

* credentials are never returned to client
* credentials are never logged
* public feedback token cannot access Google connection management

Use mocks/fakes for Google API calls.

Do not make the normal automated test suite depend on live Google credentials.

Google explicitly states there is no sandbox environment for the Business Profile APIs, so live API testing must be separated from deterministic automated tests.

## 19. Database Migration

Create a real Prisma migration.

Do not rely only on:

```bash
prisma db push
```

Verify the migration is committed.

Run:

```bash
npm run db:generate
```

and the project's appropriate migration validation command.

Do not modify unrelated existing migrations.

## 20. Documentation

Update only the necessary documentation.

Document:

* required Google Cloud configuration
* OAuth redirect URI
* required scope
* Business Profile API approval prerequisite
* required environment variables
* local development limitations
* deployment configuration requirements
* security requirements

Do not put real credentials into documentation.

## 21. Progress Tracker

Before implementation:

Update:

`context/progress-tracker.md`

Mark Feature 04 as:

```text
IN PROGRESS
```

After successful implementation and verification:

```text
COMPLETED
```

If an external prerequisite prevents completion, record the exact blocker instead of pretending the feature is complete.

## 22. Required Verification

Run:

```bash
npm run lint
npm run type-check
npm run test
npm run build
npm run db:generate
```

Also validate the Prisma migration appropriately.

Do not claim success unless the commands actually pass.

## 23. Scope Discipline

This is a focused vertical slice.

Do not:

* refactor Feature 02
* rewrite Feature 03
* change the AI provider
* implement Google reviews
* implement Google replies
* add Pub/Sub
* add billing
* add analytics
* introduce microservices
* redesign the entire UI
* replace the authentication architecture without evidence
* modify unrelated files

If a prerequisite is missing, document it rather than silently expanding scope.

## 24. Definition of Done

Feature 04 is complete only when:

* Google integration has a dedicated domain boundary
* OAuth flow is server-side
* OAuth state protection exists
* credentials are protected
* Google account discovery works through the provider abstraction
* location discovery works through the provider abstraction
* tenant-scoped connection persistence exists
* tenant isolation is tested
* administrator can select a location
* connection status is displayed
* Google API failures are safely handled
* Prisma migration is committed
* documentation is updated
* lint passes
* type-check passes
* tests pass
* build passes
* database generation/migration validation passes
* progress tracker is updated

Do not mark Feature 04 complete if Google API access is unavailable because the project's Google Cloud/GBP API approval has not yet been granted. In that case, implement and test the architecture with provider mocks and clearly document the external prerequisite.
