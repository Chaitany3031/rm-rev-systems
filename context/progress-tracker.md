# Progress Tracker

## Current phase

Phase 1 — Core features and integration

## Current goal

Feature 00 — Authentication & Tenant Membership Foundation

## Completed

- **Feature 01 — Foundation** completed and verified.
- **Feature 02 — Public Customer Feedback Experience** completed and verified.
- **Feature 03 — AI-Assisted Review Draft Generation** completed, hardened, and verified.
- **Feature 04 — Google Business Profile Connection** completed and verified.
- **Feature 05 — Google Business Profile Review Sync & Inbox** completed and verified.
- Security hardening added to Feature 05 (requireTenantAdmin on server actions and admin page).

## In progress

**Feature 07 — AI Reply Approval Workflow** (implementation in progress 2026-09-18):
- Complete the server-side approval lifecycle for ReviewReplyDraft using the authenticated tenant admin context.
- Preserve exact draft content while tracking approval state metadata and the approving administrator.
- Ensure edit/regeneration invalidates any prior approval and resets the draft to DRAFT.
- Keep approval isolated to the authenticated tenant and never publish to Google.
- Verify approval logic and authorization boundaries with focused tests.

**Feature 00 — Authentication & Tenant Membership Foundation** (security remediation in progress 2026-09-18):
- Harden the auth configuration so production fails closed without a configured `AUTH_SECRET` and without a configured production provider.
- Restrict development `Credentials` sign-in to an explicit local-only flag instead of `NODE_ENV !== "production"`.
- Keep session identity tied to the persisted Prisma `User` record and require `TenantMembership` to authorize admin access.
- Canonicalize the authenticated tenant ID in the Google location-selection server action so the browser cannot override it.
- Preserve the existing historical Prisma migrations and avoid rewriting database history while fixing the security boundary and documentation.

The feature remains dependent on environment-specific external auth configuration for live production sign-in, but the repository must no longer silently accept a predictable secret or insecure dev defaults.

## Next up

1. Feature 08 — Publication automation (deferred — explicitly out of scope for Feature 07)

## Recently completed

- **Feature 07 — AI Reply Approval Workflow** (implementation remediation in progress, 2026-09-16):
  - Added tenant-scoped approval persistence to `ReviewReplyDraft` with `DRAFT` represented by `approved = false` and `APPROVED` by `approved = true`, approval timestamp, optional administrator identity, and a tenant/approval index.
  - Added a separate Prisma migration for approval fields and the existing `User` relation; the previous Feature 06 migration was left unchanged.
  - Implemented validated admin approval through the existing `requireTenantAdmin` boundary and an atomic tenant-scoped transition that rejects missing, cross-tenant, repeated, and concurrent approvals safely.
  - Editing or regenerating a draft clears prior approval metadata. Approval preserves the exact draft content and never changes `GoogleReview`, its existing reply, Google credentials, or Google APIs.
  - Extended the existing Reviews Inbox with server-returned approval state, approval timestamp, disabled approving state, and safe success/error handling. No publish control was added.
  - Added focused domain and server-action tests. The remaining prerequisite is a real server-side authentication/session provider and membership resolver; `requireTenantAdmin` currently cannot establish user identity. Live migration status could not be checked because `DATABASE_URL` is not configured in this environment.

- **Feature 06 — Security Hardening** (2026-09-16):
  - **Critical security fix**: All four server actions in `reply-actions.ts` were passing `googleReviewId` or `draftId` to `requireTenantAdmin()`, which expects a tenant identifier. This caused runtime authorization failures.
  - **Pattern adopted from Feature 04/05**: Server actions now accept `tenantId` from client, authenticate with `requireTenantAdmin(tenantId)`, then use ONLY the authenticated `admin.tenantId` for all domain service calls—never the browser-supplied value.
  - **Fixed actions**: `generateReplyDraftAction`, `editReplyDraftAction`, `regenerateReplyDraftAction`, `fetchReplyDraftAction` — all now follow the secure Feature 04/05 pattern.
  - **UI updates**: `reviews-inbox-client.tsx` now passes `tenantId` (from props) to all reply action calls. Removed `tenantId` from `ReplyDraftPanelProps` (server-only concern). Fixed save button state to use dedicated `isSaving` flag instead of `isGenerating`.
  - **Minor fixes**: Fixed typo in `reply-service.ts` docstring ("***" → "must").
  - **New test suite**: `tests/reply-actions-authorization.test.ts` (40 tests) — verifies all four actions reject unauthenticated/public-token requests, use authenticated tenant ID (not browser-supplied), enforce cross-tenant isolation, and handle missing reviews/drafts correctly.
  - **Verification**: All 194 tests pass (8 test suites). Lint, type-check, build, and Prisma generate all succeed.

- **Feature 06 — AI-Assisted Google Review Reply Draft** (implemented 2026-09-16):
  - Strictly AI reply DRAFT generation/editing only. No Google reply publishing, approval workflow, automatic replies, Pub/Sub, queues, cron, or workers.
  - Added `ReviewReplyDraft` Prisma model (unique constraint on tenantId+googleReviewId → one current draft per review), with cascade relations to `Tenant` and `GoogleReview`.
  - Created database migration `20260916130000_add_review_reply_draft` matching the schema.
  - Extended `AIProvider` interface with `generateReplyDraft()`; added the `generateReplyDraft` method to the mock provider and a deterministic, grounded reply prompt (`domains/ai/prompts/review-reply.ts`).
  - Built `domains/reviews/reply-service.ts` with `generateReplyDraft`, `regenerateReplyDraft`, `updateReplyDraft`, and `getReplyDraft` — all tenant-scoped via the authenticated `requireTenantAdmin()` boundary. Review loads use strict (id, tenantId) filters; draft writes store the authenticated tenantId. AI output is validated (non-empty, ≤1000 chars) and wrapped as `ExternalServiceError` on provider failure.
  - Added `domains/reviews/reply-validation.ts` (request, output, input, and update schemas) and `domains/reviews/reply-service.ts`.
  - Added server actions (`app/admin/google/reviews/reply-actions.ts`) and an AI Reply Draft panel in the reviews inbox UI (`reviews-inbox-client.tsx`) with generate/edit/regenerate and existing-draft loading.
  - Created `tests/ai-reply-draft.test.ts` (34 tests) covering validation, tenant isolation, cross-tenant denial, authorization, draft persistence scoping, AI output validation, and mock reply grounding (no hallucinated facts).
  - Total test suite: 177 tests passing across 7 test suites. `npm run lint` (0 errors/0 warnings), `npm run type-check`, and `npm run build` all pass. Prisma generate succeeds. Migration file validated against schema (database not reachable offline; `prisma validate` requires DATABASE_URL).

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

- Exact production authentication provider configuration. (No provider dependency, session mechanism, or provider credentials currently exist; must be selected and configured before private admin operations can be enabled.)
- Feature 07 cannot be marked complete until the real server-side authentication/session provider resolves the current user; membership and `ADMIN` role verification now exist in the auth boundary.
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
