# AI Workflow Rules

## Core method

This repository uses a repository-driven, spec-first AI implementation workflow.

The user should describe **what they want built**, not manually author the engineering prompt. The coding agent owns implementation planning; the user approves meaningful product decisions and execution.

## Required loop

1. Read `AGENTS.md`.
2. Read the required project context files.
3. Read the relevant feature specification only.
4. Inspect the existing implementation.
5. Read relevant skills and authoritative external documentation when required.
6. Create `prompts/<feature-slug>.md` containing the implementation plan.
7. If execution was not explicitly authorized, ask the user for approval.
8. Implement only the approved scope.
9. Run relevant tests, lint, type-check, build, and database checks.
10. Update `context/progress-tracker.md` with the real result.
11. Update durable context only when a real product or architecture decision changed.
12. Report the exact verification performed and manual test steps.

## Explicit execution

When the user says "implement", "build", "fix", "execute", or otherwise explicitly authorizes the task, the agent should create the prompt itself and proceed unless a meaningful product/security ambiguity or destructive operation requires confirmation.

The user must not be sent back to ChatGPT to obtain a prompt that the repository agent can generate itself.

## Fresh sessions

Use a fresh AI coding session for each feature or unrelated task when practical. Every session reconstructs context from the repository.

## Prompt files

Prompt files are implementation plans. They must include:

- goal
- user-visible outcome
- context/specs/skills read
- existing code inspected
- decisions/assumptions
- files likely to change
- implementation requirements
- security and tenant isolation
- database/migration impact
- acceptance criteria
- verification commands
- manual test steps
- explicit out-of-scope work

Do not put secrets or chat transcripts in prompt files.

## Scope

- One feature unit at a time.
- No unrelated refactors.
- No future-feature implementation.
- Preserve working behavior outside the requested scope.
- Record genuine blockers rather than guessing.

## Security

- Never trust browser identity, role, or tenant ID as authorization.
- Use the authenticated server-side identity and canonical tenant.
- Keep Google credentials and all secrets server-side.
- Validate all external/public input.
- Treat AI output as untrusted.
- Never weaken authorization to make tests pass.

## External integrations

Verify current authoritative documentation before implementing external API behavior. For Google Business Profile functionality, use official Google documentation and current API capabilities.

## Verification

Never claim a check passed unless it was run.

Minimum relevant checks:

- `npm run test`
- `npm run lint`
- `npm run type-check`
- `npm run build`
- `npm run db:generate`

Add migration, integration, and browser checks when the feature requires them.

## Context maintenance

Context documents describe durable decisions, not temporary debugging transcripts. Keep them concise and update them only when the project decision itself changes.
