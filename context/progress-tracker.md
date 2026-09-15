# Progress Tracker

## Current phase

Phase 0 — Product and engineering foundation

## Current goal

Feature 02 — Public Customer Feedback Experience completed and verified. Ready for Feature 03 (AI-Assisted Review Draft Generation).

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

## In progress

None (Feature 02 complete).

## Next up

1. Feature 03 — AI-Assisted Review Draft Generation.

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
