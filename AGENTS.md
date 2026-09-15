<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI Agent Instructions

## Required context order

Before changing code, read:
1. `AGENTS.md`
2. `context/project-overview.md`
3. `context/architecture.md`
4. `context/ui-context.md`
5. `context/code-standards.md`
6. `context/ai-workflow-rules.md`
7. `context/progress-tracker.md`
8. Only the feature spec relevant to the current task

## Working rules

- Work on one feature unit at a time.
- Do not invent requirements, APIs, integrations, or product behavior.
- Treat the context files as the persistent source of project decisions.
- Resolve ambiguity by recording an open question instead of guessing.
- Do not modify unrelated files or perform unrelated refactors.
- Keep modules small and easy to change.
- Preserve security, privacy, accessibility, and data ownership boundaries.
- Never commit secrets or credentials.
- Verify external API capabilities from authoritative documentation before implementing integrations.
- For Google Business Profile functionality, do not assume review posting or reply automation is available; verify the current official API scope and policies first.

## Feature workflow

1. Read the required context.
2. Read the relevant feature specification.
3. Update `context/progress-tracker.md` with intended work.
4. Implement only that feature.
5. Run relevant tests, lint, type checks, and build checks available in the project.
6. Fix issues caused by the feature.
7. Update `context/progress-tracker.md` with the actual result.
8. Update architecture or other context files if a real project decision changed.
9. Summarize files changed and verification performed.

Do not begin a future feature in the same task unless explicitly requested.
