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

Edit `.env.local` with your database URL, application URL, and authentication secrets:

```env
NODE_ENV=development
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DB_NAME?schema=public
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_SECRET=<generate-a-long-random-secret>
NEXTAUTH_URL=http://localhost:3000
AUTH_PROVIDER=google
AUTH_ENABLE_DEV_CREDENTIALS=false
DEV_AUTH_EMAIL=admin@example.com
DEV_AUTH_PASSWORD=<set-a-long-random-local-password>
```

> **Security**: Never commit `.env.local` or any file containing real credentials. The `.env.example` file contains placeholders only.

### Authentication

The application uses NextAuth.js with JWT-based server sessions. The session cookie is server-side and protected by `AUTH_SECRET`, while the user identity is resolved from the authenticated session before any tenant membership lookup occurs.

CODE IMPLEMENTED: production authentication is configured through the NextAuth provider boundary. The app will use the configured Google OAuth provider when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are available and `AUTH_PROVIDER=google`, while the local development credentials provider remains off by default and only activates when `AUTH_ENABLE_DEV_CREDENTIALS=true` plus `DEV_AUTH_EMAIL` / `DEV_AUTH_PASSWORD` are set.

EXTERNAL CONFIGURATION REQUIRED: for production sign-in, configure a real Google OAuth application in Google Cloud Console, authorize the callback URL, and set the environment variables for `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, and `NEXTAUTH_URL` (or the equivalent provider config). Without those values, the app fails closed instead of silently using a public fallback secret or insecure dev login.

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
