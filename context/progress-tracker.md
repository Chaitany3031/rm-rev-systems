# Progress Tracker

## Current phase

Phase 0 — Product and engineering foundation

## Current goal

Feature 04 — Google Business Profile Connection completed and verified.

## Completed

- Repository initialized.
- Accidental `v1` / `v2` structure removed; root-level structure is canonical.
- Root-level AI workflow structure established.
- Product overview documented.
- UI principles documented.
- Code standards documented.
- AI workflow rules documented.
- Google Business Profile capabilities researched against official documentation.
- Baseline architecture locked as a modular, multi-tenant monolith.
- Customer feedback and Google review-management boundaries defined.
- Feature 01 specification written and reviewed.
- Feature 02 specification written and reviewed (`context/feature-specs/02-public-feedback.md`).
- Feature 03 specification written and reviewed (`context/feature-specs/03-ai-review-draft.md`).
- **Feature 01 — Foundation completed and verified (2026-09-16)**:
  - Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 foundation scaffolded.
  - shadcn/ui primitive conventions created (`Button`, `Card`, `Input`, `Label`, `Badge`).
  - Modular domain stubs established (`tenants`, `services`, `feedback`, `reviews`, `ai`, `google`, `auth`, `audit`).
  - PostgreSQL + Prisma ORM configured with multi-tenant base models (`User`, `Tenant`, `TenantMembership`, `AuditLog`) and seed stub.
  - Typed and validated server-side environment configuration via Zod (`lib/env/index.ts`).
  - Centralized error classes with `AppError` hierarchy and safe logging helpers (`lib/errors/index.ts`).
  - Reusable boundary validation utilities with Zod (`lib/validation/index.ts`).
  - Shared utility functions (`lib/utils/index.ts`, `lib/utils/cn.ts`).
  - Automated unit testing configured via Vitest (`tests/foundation.test.ts` — 17 unit tests passing).
  - Production build tested and passing via Next.js Turbopack compiler.
  - Full developer workflow scripts configured: `lint`, `type-check`, `test`, `build`, `db:generate`, `db:migrate`, `db:seed`.
  - Comprehensive `README.md` and `.env.example` created.
- **Feature 02 — Public Customer Feedback Experience completed and verified (2026-09-16)**:
  - Extended Prisma schema with multi-tenant models: `Service`, `FeedbackSubmission`, and `FeedbackService` (preserving historical snapshots of service names).
  - Configured Prisma seed with RM Solution development tenant (`slug: rm-solution`, `publicToken: rm-solution-dev`) and 9 active catalog services.
  - Implemented domain services with strict tenant isolation:
    - `domains/tenants`: `getTenantByPublicToken` (opaque public token resolution).
    - `domains/services`: `getActiveServicesForTenant` (active service catalog retrieval).
    - `domains/feedback`: Constants, types, Zod boundary validation schemas (`feedbackSubmissionSchema`), and core submission engine (`submitFeedback`).
  - Implemented public feedback user experience (`/feedback/[publicToken]`):
    - Server Component route with dynamic metadata and safe error/not-found/empty states.
    - Mobile-first, responsive, accessible `FeedbackForm` Client Component:
      - Accessible multi-select service cards with non-color-only checked states.
      - Accessible 1–5 star rating radiogroup with text badge labels and keyboard navigation.
      - Optional written feedback textarea with live character counter.
      - Client & server validation error handling with field-level and form-level alerts.
      - Safe submission via Server Action (`submitFeedbackAction`).
      - Dedicated success state confirming receipt without automatic review publication or manipulative prompts.
  - Added comprehensive test suite (`tests/public-feedback.test.ts` — 25 tests, total 42 tests passing across suite).
  - Verified 100% clean passes on `lint`, `type-check`, `test`, `build`, and `db:generate`.
- **Feature 03 — AI-Assisted Review Draft Generation completed, hardened, and verified (2026-09-16)**:
  - Extended Prisma schema with persisted `ReviewDraft` model linked 1-to-1 to `FeedbackSubmission` with strict `Tenant` ownership cascading.
  - Added Prisma migrations (`20260916000000_init` baseline and `20260916095531_add_review_draft`) with migration lock file.
  - Implemented real tenant authorization pipeline: `publicToken + submissionId` -> resolve tenant -> load submission scoped strictly to `tenant.id` -> persist draft under same tenant. Cross-tenant attacks (Tenant A token + Tenant B submission) are strictly denied at domain and server action levels.
  - Designed provider-agnostic `AIProvider` interface (`domains/reviews/types.ts` & `domains/ai/index.ts`) ensuring domain logic is decoupled from vendor SDKs.
  - Implemented deterministic, grounded `MockAIProvider` for local development/testing: dynamically reflects rating sentiment (1–5 stars), business name, selected services, and customer feedback without universal positive bias or hallucinated facts.
  - Defined isolated, non-manipulative review drafting system prompt (`domains/ai/prompts/review-draft.ts`) strictly enforcing first-person customer voice without hallucinated facts.
  - Created domain service `generateReviewDraft` (`domains/reviews/service.ts`) with:
    - Structured input preparation based solely on verified feedback and active service snapshot records.
    - Strict boundary and output length validation (1–1000 characters).
    - Dedicated persistence in `ReviewDraft` keeping original customer feedback immutable.
    - Safe error handling wrapping provider failures in `ExternalServiceError` without corrupting state.
  - Implemented server action `generateReviewDraftAction` (`app/feedback/[publicToken]/actions.ts`) preserving public token context with safe, sanitized error responses preventing credential/stack trace leakage.
  - Extended customer-facing UI (`app/feedback/[publicToken]/feedback-form.tsx`):
    - Multi-stage feedback submission into editable AI review draft workflow.
    - Distinct loading/generating indicator, editable draft textarea, error banner with retry option, and one-click copy to clipboard with 3-second visual confirmation.
    - Explicit AI-generation callout informing customers they have full control to edit or discard.
  - Added comprehensive test suite (`tests/ai-review-draft.test.ts` — 31 tests, total 73 tests passing across entire suite, covering cross-tenant rejection, invalid public tokens, provider failure, rating variations, and immutability).
  - Verified 100% clean passes on `lint`, `type-check`, `test`, `build`, and `db:generate`.
- **Feature 04 — Google Business Profile Connection completed and verified (2026-09-16)**:
  - Extended Prisma schema with `GoogleConnection` model (1-to-1 with `Tenant`, cascade on delete) and generated migration `prisma/migrations/20260916120000_add_google_connection/migration.sql`.
  - Implemented token encryption at rest via AES-256-GCM (`domains/google/crypto.ts`) with tamper detection and safe decryption error wrapping.
  - Implemented HMAC-SHA256 signed OAuth state lifecycle (`domains/google/oauth/state.ts`) with expiration checks and tenant binding to prevent CSRF and cross-tenant callback injections.
  - Implemented provider-agnostic `GoogleBusinessProfileProvider` abstraction (`domains/google/business-profile/provider.ts` and `domains/google/provider.ts`) supporting live Google OAuth/API and deterministic mock provider with configurable failure/empty scenarios.
  - Implemented Google domain service operations with strict tenant isolation (`domains/google/business-profile/service.ts`):
    - `initiateGoogleConnection`: Generates signed state and official Google OAuth authorization URL.
    - `processOAuthCallback`: Validates signed state, exchanges authorization code, discovers accounts and locations, securely encrypts credentials at rest, and persists connection.
    - `selectGoogleLocation`: Associates specific business location with tenant connection.
    - `getGoogleConnectionForTenant`: Returns sanitized `GoogleConnectionPublicInfo` (strictly omitting internal tokens and ciphertext).
    - `disconnectGoogleConnection`: Clears encrypted credentials, marks status `DISCONNECTED`, and performs best-effort provider token revocation.
  - Created authentication authorization boundary (`domains/auth/`) to prevent unprivileged public token callers from accessing administrative connection actions.
  - Created OAuth callback Route Handler (`app/api/google/oauth/callback/route.ts`) with safe error redirection and state validation.
  - Created Server Actions (`app/admin/google/actions.ts`) with robust authorization and sanitized error reporting.
  - Built administrative management UI (`app/admin/google/page.tsx` and `app/admin/google/google-connection-client.tsx`) supporting connection initiation, status badges, location details, disconnect confirmation, and error/success alerts.
  - Added comprehensive automated test suite (`tests/google-connection.test.ts` — 42 tests covering encryption, OAuth state, provider mock/HTTP URL, domain services, tenant isolation, server actions, and Zod schemas).
  - Total test suite: 115 tests passing across 4 test suites (`tests/foundation.test.ts`, `tests/public-feedback.test.ts`, `tests/ai-review-draft.test.ts`, `tests/google-connection.test.ts`).
  - Verified 100% clean passes on `npm run test`, `npm run lint`, and `npm run build`.

## In progress

None.

## Next up

1. Feature 06 — AI Reply Draft (or next roadmap feature).

## Recently completed

- **Feature 05 — Google Business Profile Review Sync & Inbox** (completed 2026-09-16):
  - Implemented GoogleReview Prisma model with tenant isolation and idempotent sync support via unique constraint on (tenantId + googleReviewName).
  - Created database migration `20260916065500_add_google_review` with proper indexes and foreign key cascade constraints.
  - Extended GoogleBusinessProfileProvider with `listReviews()` method supporting paginated Google Business Profile Review API calls (both HTTP and Mock implementations).
  - Built review sync service (`domains/google/reviews/service.ts`) with `syncGoogleReviews()`, `getTenantReviews()`, and `getReviewById()` functions.
  - Added server actions (`app/admin/google/reviews-actions.ts`) following existing ActionResult pattern for error handling.
  - Built admin reviews inbox UI (`app/admin/google/reviews/page.tsx` and `reviews-inbox-client.tsx`) with manual sync button, star rating filter, pagination, and status badges.
  - Added "Reviews Inbox" button to GoogleConnectionClient when connection is CONNECTED.
  - **Security hardening (2026-09-16):** Added `requireTenantAdmin` to server actions and admin page to enforce authentication, prevent anonymous access, and block cross-tenant data exposure.
  - Created comprehensive test suites (`tests/reviews-sync.test.ts` — 17 tests + `tests/reviews-authorization.test.ts` — 14 tests) covering validation, sync logic, pagination, tenant isolation, authorization, and error scenarios.
  - Total test suite: 143 tests passing across 6 test suites.
  - Verified 100% clean passes on `npm run test`, `npm run lint`, `npm run type-check`, and `npm run build`.

## Open questions / deferred decisions

- Exact production authentication provider configuration. (Recorded: will use Next.js server-side auth abstraction; exact provider deferred to a future feature that requires it.)
- Exact AI provider/model and pricing strategy. (Deferred to AI feature.)
- Exact queue/worker provider. (Deferred to a feature requiring async work.)
- Exact observability provider. (Deferred to a feature requiring observability.)
- Exact hosting/database vendor. (Recorded: Vercel-compatible deployment + managed PostgreSQL per architecture.)
- Production Google OAuth credentials and Business Profile API access approval. (Deferred to Google integration feature.)
- Final visual token values. (Deferred per UI context.)

These decisions must be resolved when a feature actually depends on them. Coding agents must not guess.

## Locked architecture decisions

- Next.js + TypeScript.
- Tailwind CSS + shadcn/ui.
- Next.js server routes/actions with thin entry points and domain services.
- PostgreSQL + Prisma.
- Zod for boundary validation.
- Provider-agnostic AI service boundary.
- Official Google Business Profile APIs behind a dedicated Google integration boundary.
- Google notifications/Pub/Sub where applicable.
- Modular monolith for the initial product; no premature microservices.
- Multi-tenancy from the beginning; RM Solution is the first tenant.
- One overall 1–5 rating per feedback submission initially.
- Customer feedback is separate from Google reviews.
- Customer controls whether to publish a generated review.
- Google reply automation is initially approval-based and later opt-in.
- Google credentials never enter the browser or AI layer.

## Session notes

The repository is intentionally root-level. The earlier `v1` / `v2` duplication was removed so there is one canonical project structure.

Architecture was reviewed and locked on 2026-09-16. Foundation implementation was verified with lint, type-check, unit tests, and production build with zero errors.
