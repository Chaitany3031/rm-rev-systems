# Architecture

This document records decisions that affect the whole system. Unknown decisions must remain explicit rather than being invented by an AI coding agent.

## Current status

Architecture is in design/foundation phase. Application implementation is blocked until the required decisions below are resolved.

## Stack

| Area | Decision | Status |
|---|---|---|
| Frontend | TBD | Open |
| Backend/API | TBD | Open |
| Database | TBD | Open |
| Authentication | TBD | Open |
| AI provider/model routing | TBD | Open |
| Hosting/deployment | TBD | Open |
| File/object storage | TBD | Open |
| Observability | TBD | Open |

## System boundaries

The system has these conceptual boundaries:

- Public customer feedback experience.
- Private feedback storage.
- AI review-drafting service.
- Client/business configuration and service catalog.
- Future administrative experience.
- Optional external integrations such as Google Business Profile.

External integrations must remain behind explicit service boundaries so they can be changed without rewriting the customer flow.

## Storage model

The exact database and schema are TBD.

The eventual model should distinguish at minimum:

- Client/business identity and configuration.
- Services offered by a client.
- Feedback submissions.
- AI-generated drafts and generation metadata where retention is required.
- External integration configuration and authorization metadata.

Secrets and access tokens must never be stored as ordinary application data or committed to source control.

## Auth and access model

Public customer submission should require only the minimum identity information necessary for the approved flow.

Administrative and client-management operations must be authenticated and authorized.

The system must enforce client ownership boundaries so one client cannot access another client's data.

Exact roles and authentication provider are TBD.

## Product invariants

- Customer feedback remains distinguishable from an AI-generated draft.
- AI must not invent services, experiences, facts, or claims supplied by the customer.
- Customers retain control over whether to publish a review.
- Service catalog data is not duplicated across UI conditionals.
- External integrations cannot bypass authorization and ownership checks.
- No secret belongs in client-side code or source control.
- Feature work must not silently change global architecture.

## Open architecture decisions

1. Frontend/framework.
2. Backend strategy.
3. Database.
4. Authentication and admin roles.
5. AI provider and model-routing strategy.
6. Deployment platform.
7. Single-client first versus multi-tenant from the beginning.
8. Whether the rating is one overall rating or one rating per selected service.
9. Exact Google Business Profile API capabilities and permissions required.
10. Data retention and privacy requirements.

Until these are decided, agents must mark dependent work as blocked instead of guessing.