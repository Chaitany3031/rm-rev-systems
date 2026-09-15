# Context Templates

Reusable Markdown context files for specification-driven AI-assisted software
development.

These templates are designed for projects developed with AI coding tools such
as Cline, Kilo, Hermes, Cursor, Claude Code, or other repository-aware agents.

## Purpose

The goal is to make AI-assisted development:

- More predictable
- Easier to review
- Easier to continue across multiple sessions
- Less vulnerable to context loss
- Safer for production projects
- Easier to maintain and modify later

The repository separates stable project knowledge from individual feature
requirements.

## Recommended Structure

Copy the templates into the root of a project or into a dedicated `context/`
directory:

```text
your-project/
├── AGENTS.md
├── context/
│   ├── project-overview.md
│   ├── architecture.md
│   ├── code-standards.md
│   ├── ui-context.md
│   ├── ai-workflow-rules.md
│   ├── progress-tracker.md
│   └── feature-specs/
│       ├── 01-foundation.md
│       ├── 02-authentication.md
│       └── 03-feature-name.md
└── src/