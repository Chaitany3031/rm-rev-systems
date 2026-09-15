# Code Standards

## General

- Prefer simple, explicit code over clever abstractions.
- Keep modules small and single-purpose.
- Do not introduce dependencies without a concrete need.
- Avoid unrelated refactors while implementing a feature.

## Type safety

- Use strict typing wherever the selected stack supports it.
- Avoid `any` and unsafe casts.
- Validate data at system boundaries.
- Keep domain types separate from external API payloads when useful.

## Application boundaries

- Keep public UI, business logic, persistence, and external integrations separated.
- Do not place business rules in presentation components when they can live in a domain/service layer.
- Keep external API clients isolated behind adapters/services.
- Validate authentication and authorization on every protected server operation.

## Data and privacy

- Never commit secrets, API keys, OAuth credentials, or tokens.
- Use environment configuration for secrets.
- Collect only data required by an approved product requirement.
- Avoid logging customer feedback, credentials, or tokens unnecessarily.
- Enforce client ownership boundaries on server-side data access.

## Product-specific rules

- Service definitions must be data-driven.
- Do not hardcode service IDs into unrelated UI logic.
- AI output is untrusted generated content and must be handled accordingly.
- AI prompts must be based on structured, validated inputs.
- Customer-provided facts must not be silently replaced by invented claims.
- Google and other external integrations must use explicit adapters rather than leaking provider details through the application.

## Quality

Each feature should include appropriate tests and validation for its risk level. Before a feature is considered complete, run the project's available lint, type-check, test, and build commands.