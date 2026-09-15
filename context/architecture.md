# Architecture

This document is the source of truth for whole-system decisions. Coding agents must not invent architecture, integrations, security behavior, or product rules.

## Status

Baseline architecture is locked for Foundation implementation.

## Stack

| Area | Decision |
|---|---|
| Application | Next.js + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend/API | Next.js server routes/actions + domain services |
| Database | PostgreSQL |
| ORM | Prisma |
| Validation | Zod |
| Authentication | Server-side auth abstraction; exact provider configuration deferred to Foundation |
| Authorization | Tenant membership + roles |
| AI | Provider-agnostic AI service interface |
| Google integration | Official Google Business Profile APIs behind a dedicated integration boundary |
| Google events | Business Profile Notifications API + Pub/Sub where applicable |
| Async work | Worker/queue abstraction, introduced when required |
| Testing | Vitest + Playwright |
| Deployment | Vercel-compatible deployment + managed PostgreSQL |
| Observability | Structured logs + error-tracking abstraction |

## Architectural style

Version 1 is a **modular monolith**, not a microservice system. Domain boundaries must be explicit so individual domains can be extracted later if scale requires it.

Primary domains:

- `tenants` — business identity, configuration, memberships, roles.
- `services` — tenant-owned service catalog.
- `feedback` — public customer feedback submissions.
- `reviews` — review drafts and approval workflow owned by our application.
- `ai` — generation, provider routing, prompts, and model metadata.
- `google` — authorization, Business Profile locations, review synchronization, replies, and Google events.
- `auth` — authentication/session integration and authorization helpers.
- `audit` — security and business-action history.

## Multi-tenancy

The system is **multi-tenant from the beginning**. RM Solution is the first tenant, not a special code path.

Conceptual ownership:

```text
Tenant
├── Users / Memberships
├── Services
├── FeedbackSubmissions
├── ReviewDrafts
├── GoogleConnections
├── GoogleLocations
└── AuditLogs
```

Every tenant-owned resource must have a server-side tenant ownership check. An untrusted client identifier must never be sufficient to access another tenant's data.

## Customer feedback flow

```text
Public feedback link / QR
        ↓
Tenant service catalog
        ↓
Service selection
        ↓
One overall 1–5 rating
        ↓
Optional written feedback
        ↓
Persist feedback
        ↓
AI review draft
        ↓
Customer edits/copies
        ↓
Customer decides whether to publish publicly
```

The customer does not need admin authentication. The initial rating model is one overall rating per submission, even when multiple services are selected.

## Google Business Profile boundary

Core feedback functionality must remain usable without a Google connection.

The Google domain owns:

- OAuth authorization and token lifecycle.
- Authorized account/location discovery.
- Linking a Google location to a tenant.
- Review synchronization.
- Review-reply publication/update.
- Notification/Pub/Sub handling.
- Google-specific errors, quotas, retries, and moderation states.

Only the server-side Google integration may access Google credentials/tokens. The browser and AI layer must never receive Google OAuth tokens.

Google functionality must always be implemented against current authoritative Google documentation and policies; unsupported behavior must never be inferred.

## Google review workflow

```text
Google review
      ↓
Synchronize permitted local state
      ↓
Admin review inbox
      ↓
AI reply draft
      ↓
Admin edits/reviews
      ↓
Explicit approval
      ↓
Publish through Google API
```

Fully automatic reply publication is a later opt-in capability requiring explicit tenant authorization, auditable configuration, appropriate API access, and policy-compliant safeguards.

## AI boundary

```text
Feedback / Google Review
        ↓
ReviewDraftService / ReplyDraftService
        ↓
AIProvider interface
        ↓
Configured model provider
        ↓
Validated result
```

AI must not invent customer experiences, services, facts, guarantees, or claims; directly publish to Google; access Google credentials; bypass approval; or silently mutate unrelated data.

## Storage model

PostgreSQL is the system of record for application-owned relational data.

Initial conceptual entities:

```text
User
Tenant
TenantMembership
Service
FeedbackSubmission
FeedbackService
ReviewDraft
GoogleConnection
GoogleLocation
GoogleReview
GoogleReviewReply
AIGeneration
AuditLog
```

Google-provided content must be stored only as permitted by current Google Business Profile policies and applicable privacy requirements. Google-sourced data must be distinguishable from our own operational metadata. The design must not assume indefinite retention is allowed.

Secrets, OAuth tokens, API keys, and credentials must never be committed to source control or exposed to client-side code.

## Authentication and authorization

Private/admin operations require authentication. Tenant authorization is enforced separately from authentication.

Initial roles:

- `OWNER` — full tenant administration and integration/automation configuration.
- `ADMIN` — services, feedback, reviews, and permitted tenant settings.
- `STAFF` — limited operational access according to tenant permissions.

The exact authentication provider configuration is deferred to Foundation and must not change domain ownership rules.

## Public feedback links

Public links use tenant-scoped opaque identifiers, for example `/r/<public-token>`. A public token grants access only to the intended feedback experience and never administrative access.

Public endpoints require input validation, abuse/rate controls where appropriate, request-size limits, and safe errors.

## Security invariants

1. Tenant-owned data never crosses tenant boundaries.
2. Private operations require authentication.
3. Authorization is enforced server-side.
4. Secrets and OAuth credentials never reach the browser or AI provider.
5. External actions require explicit authorization and ownership context.
6. Public inputs are treated as untrusted.
7. AI output is untrusted generated content and is validated before use.
8. No review-gating or deceptive review behavior.
9. Customers retain control over whether/how they publish generated reviews.
10. Google data usage follows current official policy.

## Reliability invariants

1. Google outages do not make core feedback unusable.
2. External failures are explicit and never silently treated as success.
3. Retryable work is idempotent where possible.
4. External calls use bounded timeouts, appropriate retry/backoff, and rate-limit handling.
5. Important external actions are auditable.

## Deferred decisions

The following are intentionally implementation-level decisions and must be recorded here when needed:

- Exact production authentication provider configuration.
- Exact AI provider/model and pricing strategy.
- Exact queue/worker provider.
- Exact observability provider.
- Exact hosting/database vendor.
- Production Google OAuth credentials and API-access approval.
- Final visual token values.

Do not invent durable architecture for these deferred decisions.