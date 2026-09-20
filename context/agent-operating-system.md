# Agent Operating System

## Purpose

RM Review Systems uses repository-driven AI development. The goal is to make a fresh AI coding session productive without requiring the user to manually reconstruct project context or write implementation prompts.

## Source hierarchy

When sources disagree, use this order:

1. Explicit user request for the current task
2. `AGENTS.md` security and workflow rules
3. `context/architecture.md`
4. `context/project-overview.md`
5. `context/ui-context.md`
6. `context/code-standards.md`
7. Relevant feature specification
8. Existing implementation patterns
9. External authoritative documentation

Temporary chat assumptions never outrank repository context.

## Agent loop

```
REQUEST
  ↓
READ AGENTS + CONTEXT
  ↓
IDENTIFY FEATURE UNIT
  ↓
INSPECT EXISTING CODE
  ↓
READ RELEVANT SKILLS / DOCS
  ↓
CREATE prompts/<feature>.md
  ↓
APPROVAL (unless explicitly authorized)
  ↓
IMPLEMENT
  ↓
VERIFY
  ↓
UPDATE PROGRESS
  ↓
REPORT
```

## Prompt quality bar

A generated implementation prompt must be concrete enough that another fresh agent could execute it without the original conversation.

It must state what is known, what was inspected, what will change, what will not change, acceptance criteria, verification commands, and manual tests.

## Context maintenance

Only durable decisions belong in context. Temporary errors, one-off commands, and chat transcripts belong in the task/commit history, not architecture documents.

## Feature completion

A feature is not complete merely because code compiles. Completion requires the acceptance criteria, relevant tests, security boundaries, and manual verification described by its implementation prompt.

## Backlog discipline

If an issue is real but outside the current feature:

- record it as a blocker or follow-up;
- do not silently expand scope;
- continue the current feature when safe.

This keeps the project moving without losing known work.
