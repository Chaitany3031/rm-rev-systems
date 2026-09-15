# AI Coding Agent Instructions

## Purpose

This repository uses a specification-driven development workflow.

Before making code changes, understand the relevant project context and the
specific feature specification. Implement only the requested feature, verify
the result, and update the progress tracker.

## Required Reading Order

Read these files before implementing a feature:

1. `project-overview.md`
2. `architecture.md`
3. `code-standards.md`
4. `ai-workflow-rules.md`
5. `progress-tracker.md`
6. The relevant feature specification

Read `ui-context.md` when the task affects the user interface.

## Feature Implementation Rules

- Implement only the requested feature.
- Do not invent missing requirements.
- Do not implement future features.
- Do not modify unrelated files.
- Do not perform unrelated refactors.
- Follow the architecture and coding standards.
- Reuse existing utilities and components where appropriate.
- Preserve existing behavior unless the feature explicitly changes it.
- Keep modules small and focused.
- Prefer simple, maintainable solutions over unnecessary abstraction.
- Never silently ignore errors.

## Before Coding

1. Inspect the existing project structure.
2. Identify the files relevant to the feature.
3. Read the required context files.
4. Read the complete feature specification.
5. Check the progress tracker for existing work and open questions.
6. Identify ambiguities before making implementation decisions.

If a requirement is ambiguous:

- Do not guess silently.
- Record the ambiguity in `progress-tracker.md`.
- Ask for clarification when the ambiguity affects architecture,
  security, data handling, or user-visible behavior.

## During Coding

- Follow the feature specification exactly.
- Keep changes limited to the feature scope.
- Maintain existing naming and file-organization conventions.
- Validate external input.
- Handle loading, empty, error, and success states where applicable.
- Consider accessibility for user-interface work.
- Do not add dependencies unless they are necessary and justified.

## Verification

After implementation:

1. Run the relevant formatter.
2. Run linting.
3. Run type checks when available.
4. Run unit or integration tests when available.
5. Run the project build when practical.
6. Fix errors caused by the feature.
7. Review the final diff for unrelated changes.

## Progress Tracking

After verification, update `progress-tracker.md` with:

- What was implemented
- Files changed
- Verification performed
- Remaining limitations
- New open questions
- The next recommended task

Do not mark work as complete if verification has not been performed.

## Context Maintenance

Update the relevant context file when a change affects:

- Project scope
- Architecture
- Data storage
- Authentication or authorization
- Coding standards
- UI conventions
- Development workflow
- Important business rules

Keep context files accurate and concise. They are the source of truth for
future AI coding sessions.