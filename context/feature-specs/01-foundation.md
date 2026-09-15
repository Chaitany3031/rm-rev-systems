# Feature 01 — Foundation

## Status

**Planned**

## Goal

Create a minimal, production-oriented, runnable application baseline that future feature work can build on safely.

## Dependencies

Read `AGENTS.md`, the required context files, and `context/architecture.md` before implementation.

## Scope

### Application scaffold

Create a Next.js + TypeScript application using the locked architecture. Keep route/page entry points, reusable UI, domain features, and shared infrastructure clearly separated.

### UI foundation

Set up Tailwind CSS and shadcn/ui conventions. Create only the minimum reusable primitives/layout needed to demonstrate that the application runs. Do not build the customer feedback experience or dashboard yet.

### Database foundation

Set up PostgreSQL + Prisma and establish the Prisma configuration/migration workflow. Do not prematurely implement the complete product schema.

Use environment configuration for any required database connection. Never commit credentials.

### Environment configuration

Create a typed/validated server-side configuration boundary for required environment variables and an `.env.example` containing names/placeholders only.

### Validation and errors

Establish reusable conventions for boundary validation, safe user-facing errors, unexpected server failures, and safe server logging. Do not add speculative business validation.

### Authentication boundary

Create only the authentication integration boundary required by the selected server-side auth approach if needed for Foundation. Do not build roles, tenant administration, or product authorization flows yet.

### Testing

Set up automated testing. Include at least a small foundation test and a smoke/build path suitable for CI.

### Developer workflow

Provide working scripts for lint, type-check, test, and production build. Update the README with local setup, environment configuration, database setup/migrations, development, testing, and production build verification.

## Explicitly out of scope

Do not implement:

- customer service selection;
- public feedback submission;
- review generation;
- AI provider integration;
- customer review publishing flow;
- admin review inbox;
- Google Business Profile integration;
- Google review synchronization;
- Google reply publication;
- automatic reply rules;
- billing;
- product analytics;
- microservices;
- premature queue infrastructure;
- speculative integrations.

## Acceptance criteria

1. A runnable Next.js + TypeScript application exists.
2. Tailwind CSS and shadcn/ui conventions are configured consistently with `context/ui-context.md`.
3. PostgreSQL + Prisma configuration is present and usable for local development.
4. Environment configuration is documented and validated without committing secrets.
5. Basic server-side validation/error conventions are reusable.
6. Authentication setup, if required by the selected provider, is isolated and does not introduce product features.
7. Automated tests run successfully.
8. Lint, type-check, and production build commands run successfully.
9. README setup instructions are sufficient for another developer to run the project.
10. No customer, AI, Google, or future product feature is implemented accidentally.
11. No unrelated refactor or speculative dependency is introduced.
12. `context/progress-tracker.md` reflects the actual result after verification.

## Verification checklist

Run the exact project scripts available after implementation:

```text
install dependencies
lint
type-check
test
production build
```

Fix only issues caused by Feature 01.

## Implementation rules

- Read the required context before coding.
- Update `progress-tracker.md` with intended work before implementation.
- Implement only this feature.
- Do not invent missing product requirements.
- Keep modules small and reversible.
- Keep secrets server-side.
- Do not create future feature code unless required by Foundation itself.
- If a required decision is genuinely unresolved, record it in `progress-tracker.md` rather than guessing.
- After implementation, update the tracker with actual changes and verification results.
