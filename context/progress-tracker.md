# Progress Tracker

## Current phase

Phase 0 — Product and engineering foundation

## Current goal

Complete the persistent context foundation and prepare Feature 01 — Foundation for implementation.

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

## In progress

- Write and review Feature 01 — Foundation specification.
- Select exact authentication provider configuration during Foundation implementation.
- Select exact AI provider/model configuration during the AI feature, not before it is needed.

## Next up

1. Complete `context/feature-specs/01-foundation.md`.
2. Scaffold the selected application stack.
3. Verify lint, type checks, tests, and production build.
4. Update this tracker with the actual Foundation result.
5. Only then begin the public feedback feature.

## Open questions / deferred decisions

- Exact production authentication provider configuration.
- Exact AI provider/model and pricing strategy.
- Exact queue/worker provider.
- Exact observability provider.
- Exact hosting/database vendor.
- Production Google OAuth credentials and Business Profile API access approval.
- Final visual token values.

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

Architecture was reviewed and locked on 2026-09-16. Foundation implementation must remain limited to the baseline and must not implement customer feedback, AI review drafting, Google integration, or reply automation.