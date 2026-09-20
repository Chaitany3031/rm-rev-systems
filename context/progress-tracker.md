# Progress Tracker

## Current phase

Phase 1 — Core product and integration

## Current goal

Establish a repeatable repository-driven AI development workflow, then finish the customer-facing product experience.

## Completed

- **Feature 01 — Foundation** completed and verified.
- **Feature 02 — Public Customer Feedback Experience** completed and verified.
- **Feature 03 — AI-Assisted Review Draft Generation** completed, hardened, and verified.
- **Feature 04 — Google Business Profile Connection** completed and verified.
- **Feature 05 — Google Business Profile Review Sync & Inbox** completed and verified.
- **Feature 06 — AI-Assisted Google Review Reply Draft** completed and security-hardened.
- **Feature 07 — AI Reply Approval Workflow** implemented and security-hardened.
- **Feature 00 — Authentication & Tenant Membership Foundation** migrated to Clerk and hardened.
- Production-ready Clerk migration cleanup completed, including removal of legacy Auth.js/NextAuth artifacts and the required forward `User.clerkUserId` migration.
- Local database has been verified with `User.clerkUserId` and its unique index.
- Commit `7bddc65` is the current deployed application checkpoint.

## Agent workflow

**Repository-driven AI operating system** (2026-09-20):
- `AGENTS.md` now defines the full request → inspect → self-generate prompt → approval/execute → implement → verify → report workflow.
- `context/agent-operating-system.md` documents the source hierarchy, agent loop, prompt quality bar, context maintenance, feature completion, and backlog discipline.
- `prompts/README.md` defines the implementation-prompt contract and naming convention.
- `context/ai-workflow-rules.md` now makes prompt generation the agent's responsibility instead of requiring the user to author prompts.
- Fresh coding sessions must reconstruct context from the repository and relevant skills rather than hidden chat history.

## Current product work

The next product milestone is the **production customer feedback experience**:

- Review the existing `/feedback/[publicToken]` implementation.
- Make the customer flow polished and mobile-first without changing locked product behavior.
- Verify service selection, overall 1–5 rating, optional feedback, submission, AI review draft, editing, copy/handoff behavior, loading/error/success states, accessibility, and tenant isolation.
- Do not add review gating, fake reviews, automatic publication, or unrelated admin features.

After the customer flow is verified, continue with the admin product experience and remaining explicitly scoped Google capabilities.

## Production infrastructure blocker

The production database migration status cannot be verified from a terminal that lacks the production `DATABASE_URL`.

Required production-only operation when secure database access is available:
- run `npx prisma migrate status`;
- if `20260916160000_add_clerk_user_id` is pending, apply the committed migration with `npx prisma migrate deploy`;
- verify the resulting production schema.

Do not use `prisma migrate dev`, `prisma db push`, database reset, or migration-history rewrites against production.

## Open questions / deferred decisions

- Production database access/credential configuration remains an environment task, not an application-code task.
- Production Google OAuth credentials and Business Profile API access approval.
- Exact AI provider/model and pricing strategy.
- Exact queue/worker provider if future asynchronous work requires one.
- Exact observability provider.
- Final visual token values beyond currently approved UI decisions.

## Locked architecture decisions

- Next.js + TypeScript.
- Tailwind CSS + shadcn/ui conventions.
- Next.js server routes/actions with thin entry points and domain services.
- PostgreSQL + Prisma.
- Zod for boundary validation.
- Clerk authentication with local `User.clerkUserId` mapping and database-backed tenant membership authorization.
- Provider-agnostic AI service boundary.
- Official Google Business Profile APIs behind a dedicated integration boundary.
- Modular monolith for the initial product; no premature microservices.
- Multi-tenancy from the beginning; RM Solution is the first tenant.
- One overall 1–5 rating per feedback submission initially.
- Customer feedback is separate from Google reviews.
- Customer controls whether to publish a generated review.
- Google reply automation is approval-based and must not bypass explicit authorization.
- Google credentials never enter the browser or AI layer.

## Working rule

Keep moving toward the next customer-visible milestone. Treat infrastructure/access issues as explicit blockers and do not turn them into repeated architecture or audit loops.
