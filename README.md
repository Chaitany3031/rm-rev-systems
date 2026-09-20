# RM Review Systems

Customer feedback and review-assistance system for RM Solution.

## Tech Stack

- **Application**: Next.js 16 + TypeScript (App Router)
- **UI**: Tailwind CSS v4 + shadcn/ui conventions
- **Backend/API**: Next.js server routes/actions + domain services
- **Database**: PostgreSQL + Prisma ORM
- **Validation**: Zod
- **Testing**: Vitest + Playwright
- **Deployment**: Vercel-compatible

## Quick Start

### Prerequisites

- Node.js 18+ (tested on Node 24)
- npm 10+
- PostgreSQL 15+ (for local development)

### Environment Configuration

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your database URL, application URL, and Clerk authentication keys:

```env
NODE_ENV=development
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DB_NAME?schema=public
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key
CLERK_SIGN_IN_URL=/login
CLERK_SIGN_UP_URL=/sign-up
```

> **Security**: Never commit `.env.local` or any file containing real credentials. The `.env.example` file contains placeholders only.

### Authentication

Authentication is handled by Clerk. The app resolves the authenticated Clerk user ID on the server and then maps it to the local Prisma `User` record by `clerkUserId` before enforcing tenant membership and `ADMIN` checks.

This keeps the application-level authorization boundary unchanged: the browser never supplies the authenticated identity, and tenant authorization remains database-backed through `TenantMembership` and `requireTenantAdmin()`.

The separate Google Business Profile OAuth configuration remains independent of the app authentication provider and is configured via `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` when live Google APIs are enabled.

### Install Dependencies

```bash
npm install
```

### Database Setup

Generate the Prisma client from schema:

```bash
# Generate Prisma client
npm run db:generate
```

For migrations and seed data (requires PostgreSQL running):

```bash
# Create and run a migration
npm run db:migrate

# Seed development tenant (RM Solution) and initial service catalog
npm run db:seed
```

### Public Feedback Experience

Public feedback links use opaque tenant public tokens:
- URL structure: `/feedback/[publicToken]`
- Example local development URL (after seeding): `http://localhost:3000/feedback/rm-solution-dev`

### Development Server

```bash
npm run dev
```

The application will be available at http://localhost:3000.

### Testing

```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Linting

```bash
npm run lint

# Auto-fix issues where possible
npm run lint:fix
```

### Type Checking

```bash
npm run type-check
```

### Production Build

```bash
npm run build
```

The production output is in the `.next/` directory and is compatible with Vercel deployment.

### Start Production Server

```bash
npm run start
```

## Project Structure

```
app/                    Next.js App Router (page entry points)
  layout.tsx            Root layout with providers
  page.tsx              Home page (minimum demo)
  globals.css           Global styles + Tailwind imports
components/ui/          Reusable UI primitives (shadcn/ui conventions)
lib/                    Shared infrastructure
  env/                  Environment validation (Zod)
  errors/               Error classes and safe logging
  validation/           Zod boundary validation utilities
  utils/                Shared utilities (token gen, cn, etc.)
prisma/                 Prisma schema and migrations
tests/                  Vitest test files
domains/                Domain modules (tenants, services, feedback, reviews, ai, google, auth, audit)
context/                Project documentation (architecture, standards, etc.)
```

## Architecture

See `context/architecture.md` for the full architecture specification.

Key decisions:
- **Modular monolith** — not microservices
- **Multi-tenant from the beginning** — RM Solution is the first tenant
- **Provider-agnostic** AI and Google integration boundaries
- **Separation of concerns** — UI, domain, persistence, and external integrations are separated

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection URL |
| `NODE_ENV` | No | Runtime environment (`development`, `production`, `test`) — defaults to `development` |
| `NEXT_PUBLIC_APP_URL` | No | Public-facing application URL |
