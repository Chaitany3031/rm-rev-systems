# Feature 05 — Google Business Profile Review Sync & Inbox

## 1. Purpose

Build the first version of the tenant's Google Business Profile review inbox.

Feature 04 already establishes the Google OAuth connection and selected Business Profile location.

Feature 05 extends that boundary to:

```text
Google Business Profile
        ↓
Google Reviews API
        ↓
Google Integration Provider
        ↓
Review Sync Service
        ↓
PostgreSQL
        ↓
Tenant Review Inbox
```

The feature is responsible for synchronizing Google reviews into the application and displaying them to an authorized tenant administrator.

This feature must NOT generate or publish replies.

That belongs to later features.

---

# 2. Scope

## Included

* Google review provider abstraction
* Fetch reviews for the connected Google location
* Handle Google pagination
* Map Google review data into an internal domain model
* Persist reviews in PostgreSQL
* Idempotent review upsert
* Manual "Sync Reviews" operation
* Tenant-scoped review inbox
* Review listing UI
* Review rating/comment/date/reply-status display
* Sync status and errors
* Secure server-side Google credential usage
* Token refresh if required by the existing Feature 04 implementation
* Automated tests
* Prisma migration
* Context/progress tracker updates

## Explicitly excluded

Do NOT implement:

* AI reply generation
* AI reply editing
* Google reply publishing
* Automatic replies
* Reply approval workflows
* Pub/Sub notifications
* Background queues
* Cron jobs
* Analytics
* Billing
* Sentiment scoring
* Review manipulation
* Review filtering intended to suppress negative reviews
* Customer-facing Google review display
* Microservices
* Feature 06 functionality

---

# 3. Existing Architecture

Continue using the existing modular-monolith architecture.

```text
app/
domains/
  tenants/
  services/
  feedback/
  reviews/
  ai/
  google/
  auth/
  audit/
lib/
prisma/
tests/
context/
```

Feature 05 belongs primarily inside:

```text
domains/google/
```

and the existing Google integration boundary should be extended rather than creating a second Google integration system.

The UI may live under:

```text
app/admin/google/reviews/
```

or the closest existing admin convention.

Follow the current repository structure instead of inventing a parallel structure.

---

# 4. Google API Boundary

Use the official Google Business Profile APIs.

Google documents:

```text
accounts.locations.reviews.list
accounts.locations.reviews.get
accounts.locations.batchGetReviews
```

The initial implementation should use:

```text
accounts.locations.reviews.list
```

for the tenant's selected location.

Google documents the review-list endpoint as paginated.

Do not implement direct Google API calls throughout application services.

Use the existing provider abstraction:

```text
Google provider
      ↓
Review provider method
      ↓
Review sync service
```

The application domain must not depend directly on HTTP implementation details.

---

# 5. Important Google Pagination Requirement

Google currently documents a known issue where pages after the first page of `accounts.locations.reviews.list` can occasionally be inconsistent and may miss reviews.

Therefore:

* Handle pagination correctly.
* Do not assume one synchronization is permanently complete.
* Make synchronization idempotent.
* Use Google's stable review resource name as the external identity.
* Re-running synchronization must safely update existing reviews.
* Never delete a local review merely because it was absent from a particular synchronization response.
* A partially completed sync must not corrupt previously synchronized data.
* A later manual sync must be capable of recovering missing reviews.

Do not attempt to invent a custom workaround that assumes knowledge Google has not documented.

---

# 6. Domain Model

Introduce a persistent Google review entity.

Suggested model:

```prisma
model GoogleReview {
  id                       String   @id @default(cuid())
  tenantId                 String
  googleConnectionId       String

  googleReviewName         String
  googleLocationName       String

  reviewerDisplayName      String?
  starRating               Int?
  comment                  String?

  reviewCreateTime         DateTime?
  reviewUpdateTime         DateTime?

  replyComment             String?
  replyUpdateTime          DateTime?
  reviewReplyUrl            String?
  replyState               String?
  policyViolationCode       String?

  syncedAt                 DateTime @default(now())
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  tenant                   Tenant          @relation(...)
  googleConnection         GoogleConnection @relation(...)

  @@unique([tenantId, googleReviewName])
  @@index([tenantId, googleConnectionId, reviewUpdateTime])
}
```

The implementation agent must inspect the current Prisma schema and adapt naming/types to existing conventions.

Do not blindly copy this model if the existing architecture requires a better equivalent.

---

# 7. Data Minimization

Only persist data required by the current and immediately planned review-inbox/reply workflow.

Initially prioritize:

* Google review resource name
* Google location resource name
* star rating
* comment
* review creation time
* review update time
* reply comment
* reply update time
* review reply URL
* reply state
* relevant policy violation state if currently returned

Reviewer information should only be persisted if required by the inbox UI and compatible with current Google API/data policies.

Do NOT persist:

* OAuth access tokens in the review record
* refresh tokens in the review record
* arbitrary raw Google API payloads
* unnecessary profile/media data

Do not store reviewer profile photos or review media merely because the API exposes them.

---

# 8. Stable Identity

The Google review resource name is the external identity.

Example conceptual structure:

```text
accounts/{accountId}/locations/{locationId}/reviews/{reviewId}
```

Do not use:

* comment text
* reviewer name
* rating
* timestamps

as the unique review identity.

The same Google review must map to the same local record across repeated synchronizations.

---

# 9. Provider Interface

Extend the Google Business Profile provider with a review-listing capability.

Conceptually:

```ts
interface GoogleBusinessProfileProvider {
  listReviews(input: {
    accessToken: string
    locationName: string
    pageToken?: string
  }): Promise<GoogleReviewPage>
}
```

The exact interface should follow existing project conventions.

Provider output should use an internal normalized type rather than exposing raw Google API response objects throughout the domain.

Conceptually:

```ts
type GoogleReviewPage = {
  reviews: GoogleReviewData[]
  nextPageToken?: string
}
```

The provider is responsible for:

* HTTP request construction
* authentication
* Google response parsing
* provider-specific error normalization

The domain service is responsible for:

* tenant authorization
* connection lookup
* synchronization
* persistence
* business rules

---

# 10. Token Handling

Feature 05 must use the existing Feature 04 credential boundary.

Google credentials must remain server-side.

The browser must never receive:

* access token
* refresh token
* client secret
* encryption key
* raw credential payload

If the stored access token is expired, the integration layer should refresh it using the existing secure credential mechanism.

If Feature 04 already contains token refresh functionality, reuse it.

If it does not, add the smallest secure credential-refresh capability necessary inside the Google integration boundary.

Do not create a second credential system.

Do not expose token values in logs or errors.

---

# 11. Tenant Isolation

Every review operation must be tenant-scoped.

An admin for Tenant A must never be able to retrieve Tenant B's Google reviews.

Review queries must include tenant ownership.

Do not trust:

```text
googleReviewName
googleConnectionId
```

from the browser as sufficient authorization.

Resolve the authenticated tenant first.

Then query:

```text
tenantId = authenticatedTenant.id
```

and verify the associated Google connection belongs to that tenant.

Public customer tokens must not authorize review-inbox access.

---

# 12. Authorization

The review inbox is admin-only.

Use the existing:

```text
requireTenantAdmin
```

or equivalent authentication boundary.

The following must be rejected:

* anonymous access
* customer/public feedback token access
* another tenant's admin
* arbitrary tenant IDs supplied by the browser

---

# 13. Synchronization Flow

Manual synchronization:

```text
Admin clicks "Sync Reviews"
        ↓
Require authenticated tenant admin
        ↓
Load tenant's Google connection
        ↓
Load selected Google location
        ↓
Obtain valid access token
        ↓
Request first review page
        ↓
Persist reviews
        ↓
If nextPageToken exists:
    request next page
        ↓
Continue until no nextPageToken
        ↓
Return sync result
```

The sync must be idempotent.

For each Google review:

```text
find existing review by tenantId + googleReviewName
        ↓
update existing
OR
create new
```

Do not create duplicates.

---

# 14. Failure Handling

If page 1 succeeds and page 2 fails:

* Reviews successfully processed from page 1 remain persisted.
* The operation returns a controlled failure.
* Existing data must not be rolled back unnecessarily.
* The UI must communicate that synchronization did not fully complete.

Do not claim:

```text
"All reviews synced"
```

unless the entire pagination process completed successfully.

A later synchronization must be safe.

---

# 15. Missing Reviews

Do NOT delete local reviews when they are absent from a synchronization response.

The API pagination behavior is not sufficiently reliable to use absence from one sync as proof that a review was deleted.

Therefore:

```text
Google response does not contain review
        ↓
No deletion
```

Deletion/reconciliation is outside Feature 05.

---

# 16. Sync Result

Return a safe internal result such as:

```ts
type ReviewSyncResult = {
  processed: number
  created: number
  updated: number
  completed: boolean
}
```

Do not return:

* access tokens
* refresh tokens
* provider credentials
* raw Google error bodies containing sensitive information

---

# 17. Review Inbox

Create an admin review-inbox page.

Suggested route:

```text
/admin/google/reviews
```

Follow existing repository routing conventions if another admin route structure already exists.

Display:

* reviewer name when available
* star rating
* review comment
* review creation date
* review update date
* reply status
* existing reply when available
* Google review link when available
* last synchronization information

The inbox is read-only regarding Google reviews in this feature.

There must be no:

```text
Reply
Generate Reply
Publish
Auto Reply
Delete Reply
```

functionality.

Those belong to later features.

---

# 18. UI States

The page must handle:

### Loading

Display an appropriate loading state.

### Not connected

If the tenant has no Google Business Profile connection:

```text
Google Business Profile is not connected.
```

Provide navigation to the existing connection flow.

### No reviews

Show an appropriate empty state.

### Reviews available

Display reviews in a clean responsive layout.

### Syncing

Disable duplicate sync requests while synchronization is active.

Show a clear syncing state.

### Sync success

Show a safe result:

```text
Reviews synchronized successfully.
```

Optionally show:

```text
X created
Y updated
```

### Sync failure

Show a safe user-facing error.

Never expose raw Google API internals.

---

# 19. Sorting

Use Google-provided review timestamps for display and local ordering.

Prefer:

```text
reviewUpdateTime
```

when available.

Fall back appropriately when it is absent.

Do not invent unsupported Google query parameters.

The implementation must verify any `orderBy`, `pageSize`, or other optional Google parameters against the current official API documentation before using them.

---

# 20. Google Reply Fields

Google's current review APIs expose additional reply-related information, including:

* reviewReplyUrl
* ReviewReplyState
* PolicyViolation

These fields may be persisted because they support the future reply workflow.

However:

Feature 05 must only READ these values.

It must not:

* modify replies
* publish replies
* delete replies
* generate reply content

---

# 21. Testing Requirements

Add focused automated tests.

Minimum coverage:

### Provider

* first review page maps correctly
* multiple pages are handled
* nextPageToken is followed
* final page terminates correctly
* provider errors are normalized

### Persistence

* new review is created
* existing review is updated
* repeated synchronization does not create duplicates
* stable Google review name is used as identity

### Tenant isolation

* Tenant A cannot synchronize Tenant B's connection
* Tenant A cannot read Tenant B's reviews
* public feedback token cannot access the inbox

### Failure handling

* first page succeeds and second page fails
* previously persisted reviews remain available
* sync is marked incomplete/failed
* a later sync can retry safely

### Missing review behavior

* absent review does not cause local deletion

### Security

* access tokens never appear in returned API data
* refresh tokens never appear in returned API data
* credentials are not written to logs

### Authorization

* anonymous access denied
* non-admin access denied
* wrong tenant access denied

### UI/server actions

* sync action requires admin authorization
* disconnected state handled
* empty state handled
* successful sync handled
* failure state handled

Use mocked/fake Google providers.

Do NOT make tests dependent on live Google Business Profile APIs.

---

# 22. Database Migration

Create a real Prisma migration.

Do not modify production schema only through:

```text
prisma db push
```

The repository must contain the migration required to reproduce the schema.

Run:

```bash
npm run db:generate
```

and the repository's existing migration/schema validation commands where the environment allows.

If database connectivity prevents validation, document the environment limitation rather than pretending validation succeeded.

---

# 23. Context Workflow

Before implementation:

1. Read `AGENTS.md`
2. Read `context/project-overview.md`
3. Read `context/architecture.md`
4. Read `context/ui-context.md`
5. Read `context/code-standards.md`
6. Read `context/ai-workflow-rules.md`
7. Read `context/progress-tracker.md`
8. Read this Feature 05 specification

Before coding:

Update:

```text
context/progress-tracker.md
```

to indicate:

```text
Feature 05 — IN PROGRESS
```

After successful implementation:

```text
Feature 05 — COMPLETED
```

Record:

* files changed
* tests added
* migration added
* verification results
* any deviations
* unresolved environment limitations

---

# 24. Verification

Run:

```bash
npm run lint
npm run type-check
npm run test
npm run build
npm run db:generate
```

Also validate Prisma migrations where the local database environment permits.

The final implementation report must explicitly state:

```text
Lint: PASS/FAIL
Type-check: PASS/FAIL
Tests: PASS/FAIL
Build: PASS/FAIL
Prisma generate: PASS/FAIL
Migration validation: PASS/FAIL/BLOCKED
```

Do not claim success for commands that were not actually executed.

---

# 25. Definition of Done

Feature 05 is complete when:

* Google reviews can be fetched through the provider boundary.
* Pagination works.
* Reviews are normalized.
* Reviews are persisted.
* Synchronization is idempotent.
* Tenant isolation is enforced.
* Admin authorization is enforced.
* Manual sync works.
* Review inbox displays synchronized reviews.
* Existing reviews are updated rather than duplicated.
* Missing reviews are not incorrectly deleted.
* Partial sync failures are handled safely.
* Google credentials remain server-side.
* Tests cover the important security and synchronization cases.
* Prisma migration exists.
* lint passes.
* type-check passes.
* tests pass.
* build passes.
* progress tracker is updated.
* no Feature 06 functionality has been implemented.

---

# 26. Architectural Principle

The final architecture should remain:

```text
Feature 04
Google OAuth + Connection
        ↓
Feature 05
Google Review Sync + Inbox
        ↓
Feature 06
AI Reply Draft
        ↓
Feature 07
Admin Approval + Google Reply
        ↓
Feature 08
Controlled Automation
```

Feature 05 must establish a clean foundation for Feature 06 without implementing Feature 06 prematurely.
