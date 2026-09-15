# Feature 01 — Foundation

## Status

Planned / blocked until required architecture decisions are resolved.

## Goal

Create the smallest production-ready application baseline needed to begin feature development safely.

## Scope

When unblocked, this feature may include:

- Selected application scaffold.
- Environment configuration pattern.
- Base application layout.
- Error handling baseline appropriate to the selected stack.
- Health/status endpoint if the selected architecture needs one.
- Linting and formatting configuration.
- Type checking where applicable.
- Test setup.
- Build and start commands.
- Minimal setup documentation.

## Out of scope

Do not implement:

- Service selection UI.
- Customer feedback submission flow.
- AI review generation.
- Google Business Profile integration.
- Admin dashboard.
- Analytics.

Those belong to later feature specifications.

## Dependencies

Before implementation, resolve the stack decisions in `context/architecture.md` that are required to scaffold the application.

## Acceptance criteria

- Application starts using documented commands.
- Relevant lint/type/test/build checks pass.
- Environment configuration is documented without exposing secrets.
- Base error handling is present where appropriate.
- No future product feature is implemented as part of the foundation.
- `context/progress-tracker.md` reflects the actual state after implementation.
