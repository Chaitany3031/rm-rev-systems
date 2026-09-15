# AGENTS.md

## Purpose

This repository contains reusable Markdown context templates for AI-assisted software engineering. When these templates are copied into a project, the project's `AGENTS.md` should become the entry point for coding agents.

## Required workflow

Before changing code in a project that uses these templates:

1. Read the project's `AGENTS.md`.
2. Read the relevant project context files in this order:
   - `context/project-overview.md`
   - `context/architecture.md`
   - `context/ui-context.md`
   - `context/code-standards.md`
   - `context/ai-workflow-rules.md`
   - `context/progress-tracker.md`
3. Read only the feature specification relevant to the requested task.
4. Check the progress tracker for dependencies, open questions, and current status.
5. Implement one feature unit at a time.
6. Run the checks required by the project.
7. Update the progress tracker with the actual result.

## Operating rules

- Treat the project context and feature specification as the source of truth.
- Do not invent requirements, behavior, integrations, or design decisions.
- Do not implement future features unless explicitly requested.
- Do not modify unrelated files or perform unrelated refactors.
- Prefer small, reversible, verifiable changes.
- Preserve existing architecture and invariants.
- Validate external input and handle failure paths deliberately.
- If requirements are ambiguous, record the question in `progress-tracker.md` instead of guessing.
- If an architectural, security, storage, or scope decision changes, update the relevant context file.

## Completion checklist

A task is complete only when:

- The requested feature is implemented according to its specification.
- Relevant tests, linting, type checks, and builds have been run when available.
- Feature-specific errors have been fixed.
- No unrelated behavior was changed.
- `progress-tracker.md` reflects the real implementation state.
- The final response lists changed files, verification performed, and any remaining risks or open questions.