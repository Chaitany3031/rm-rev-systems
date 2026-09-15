# Progress Tracker

## Current phase

Phase 0 — Product and engineering foundation

## Current goal

Establish a clean repository structure and explicit product/architecture context before application implementation.

## Completed

- Repository initialized.
- Accidental `v1` / `v2` structure identified as a result of earlier conflicting instructions.
- Root-level AI workflow structure established.
- Product overview documented.
- Architecture boundaries and unresolved decisions documented.
- UI principles documented.
- Code standards documented.
- AI workflow rules documented.

## In progress

- Resolve architecture decisions.
- Confirm the first implementation stack.
- Confirm the exact customer rating model.
- Confirm the initial client/tenant model.

## Next up

1. Resolve architecture decisions.
2. Complete Feature 01 — Foundation specification.
3. Scaffold the selected application stack.
4. Verify the baseline before implementing customer-facing features.

## Open questions

- Which frontend/framework will be used?
- What backend/API strategy will be used?
- Which database?
- Which authentication approach and admin roles?
- Which AI provider/model-routing strategy?
- Where will the system be deployed?
- Single-client first or multi-tenant from the beginning?
- One overall rating or one rating per selected service?
- What exact Google Business Profile integration is required and officially supported?
- What data retention/privacy requirements apply?

## Architecture decisions

No final stack decision has been made yet.

## Session notes

The repository structure is intentionally root-level. `v1/` and `v2/` were created during an earlier instruction mismatch and are being removed so there is one canonical project structure.