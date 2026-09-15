# AI Workflow Rules

## Core method

This project follows a spec-driven, incremental AI development workflow.

- Persistent Markdown context is the source of project memory.
- One feature unit is implemented at a time.
- Every feature has an explicit specification before implementation.
- AI agents must read context before coding.
- Agents must not invent missing requirements.
- Ambiguity becomes an open question in the progress tracker.

## Session discipline

Use a fresh AI coding session for a new feature or unrelated task when practical. The new session must reconstruct its working context from the repository rather than relying on an old conversation.

## Before coding

1. Read `AGENTS.md`.
2. Read the project context files required by `AGENTS.md`.
3. Read only the relevant feature specification.
4. Check `context/progress-tracker.md`.
5. Identify dependencies and unresolved decisions.
6. If a required decision is unresolved, stop and record the blocker rather than guessing.

## During coding

- Implement only the requested feature.
- Keep changes small and reviewable.
- Do not rewrite working code merely because another approach is preferred.
- Do not implement future features.
- Preserve documented architecture invariants.
- Keep provider-specific code behind explicit boundaries.

## After coding

1. Run relevant checks.
2. Fix failures caused by the current feature.
3. Update the progress tracker with the real state.
4. Update architecture or standards if a durable decision changed.
5. Report files changed, checks run, and any remaining blocker.

## Context maintenance

Context files are living engineering documents. Update them when the project makes a durable decision about scope, architecture, storage, security, UI, or workflow.

Do not turn the context files into a dump of temporary implementation details.

## Protected behavior

Do not implement deceptive review flows, fake reviews, forced-positive review collection, or unverified Google Business Profile automation. Such behavior requires explicit product, policy, and authoritative API review before implementation.