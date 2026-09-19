# Feature 00 — Authentication & Tenant Membership Foundation

## Status

Planned

## Purpose

Establish a real server-side authentication and tenant-membership authorization boundary for the multi-tenant application.

This feature exists because downstream admin features currently have no real authenticated-user/session boundary.

Feature 07 approval workflow must not be considered production-ready until this foundation exists.

---

# 1. Scope

This feature establishes:

- authenticated user identity
- server-side session/current-user resolution
- tenant membership
- tenant-scoped authorization
- admin-role authorization
- reusable `requireTenantAdmin` authorization boundary
- authenticated `userId`
- authenticated `tenantId`
- safe unauthorized/forbidden behavior
- tests for authentication and tenant isolation

The implementation must fit the existing application architecture.

Do not introduce unnecessary architectural complexity.

---

# 2. Existing Architecture

The application is:

- Next.js
- TypeScript
- Prisma
- PostgreSQL
- Zod
- modular monolith
- multi-tenant from day one

Authentication must remain behind a dedicated application boundary.

Recommended domain location:

```text
domains/auth/

The exact structure may differ if the existing repository conventions require another location.

3. Critical Requirement

Authorization MUST NOT trust a tenant ID supplied by the browser.

The authoritative authorization chain must be:

Request
  ↓
Authenticated session
  ↓
Authenticated user
  ↓
Tenant membership
  ↓
Membership role
  ↓
Authorized tenant

The browser may provide contextual identifiers where necessary, but those identifiers must never establish authorization.

4. Authentication Provider

Before implementing authentication:

Inspect the existing repository.
Inspect package.json.
Inspect existing auth-related code.
Inspect Feature 04/06 auth boundaries.
Inspect Prisma schema.
Determine whether an authentication/session provider already exists.

If an authentication provider already exists:

reuse it
do not replace it
follow its established server-side session conventions

If no authentication provider exists:

do NOT fabricate authentication
do NOT create a fake session
do NOT hardcode a user
do NOT use a browser-provided userId
identify the smallest production-appropriate authentication foundation required by the project architecture

If a provider choice is genuinely required, document the decision and open question before introducing it.

5. User Identity

The system must be able to resolve an authenticated user on the server.

The authorization boundary must be able to obtain:

{
  userId: string
}

The user ID must represent the authenticated identity.

It must never come from:

query parameters
request body
hidden form fields
localStorage
client state
arbitrary headers supplied by the browser
6. Tenant Membership

Establish a persisted relationship between users and tenants.

The model should support at minimum:

User
Tenant
TenantMembership

Conceptually:

User
 └── TenantMembership
       ├── Tenant
       └── role

A membership must identify:

user
tenant
role
timestamps where appropriate

The exact Prisma field names should follow repository conventions.

7. Roles

At minimum support:

ADMIN

Additional roles must not be invented unless required by the existing application.

Authorization must verify that the authenticated user's membership for the requested tenant has the required role.

Do not infer ADMIN merely because a tenant exists.

8. requireTenantAdmin

Replace the current insecure behavior of requireTenantAdmin.

The authorization boundary must:

Resolve the authenticated session/current user.
Reject unauthenticated requests.
Resolve the user's tenant membership.
Verify ADMIN role.
Return authenticated identity.

Conceptually:

const admin = await requireTenantAdmin(...);

admin.userId
admin.tenantId
admin.role

The returned tenantId must come from authenticated membership.

The returned userId must come from authenticated session identity.

9. Tenant Selection

If the application supports multiple tenants per user, tenant selection must be explicit and server-validated.

A requested tenant may be supplied as context, but:

requested tenant
        ↓
authenticated user
        ↓
membership lookup
        ↓
verify membership exists
        ↓
verify role
        ↓
authorized tenant

A user must not gain access to another tenant merely by changing:

tenantId
tenantSlug
URL parameter
form value
request body
10. Server-Side Only

Authentication and authorization must execute server-side.

Never expose:

session secrets
OAuth client secrets
token encryption secrets
access tokens
refresh tokens
database credentials

to the browser.

Do not place authentication secrets in client components.

11. Error Handling

Use existing application error conventions.

At minimum distinguish:

Unauthenticated
Forbidden
Tenant not found / inaccessible

Do not leak:

credentials
tokens
database internals
sensitive session data

Client-facing responses should use safe error messages.

12. Feature 07 Integration Boundary

This feature should establish the foundation required by Feature 07.

Do not implement Feature 07 approval behavior in this feature.

Do not modify the approval workflow except where necessary to make the existing authorization boundary compatible with the new authentication foundation.

Feature 07 will later use:

authenticated admin
    ↓
admin.userId
admin.tenantId
    ↓
approval domain operation

This feature does NOT implement:

approval workflow
Google review publishing
AI replies
Google automation
13. Testing Requirements

Tests must verify the real authorization boundary.

Required cases:

Authentication
unauthenticated request is rejected
authenticated user resolves correctly
authenticated user ID cannot be overridden by browser input
Membership
valid tenant membership is accepted
missing membership is rejected
membership belonging to another user is rejected
Role
ADMIN is accepted
non-admin role is rejected
Tenant isolation

Test:

User A → Tenant A → ADMIN
User A → Tenant B → no membership

User A must not access Tenant B.

Also test:

authenticated Tenant A
browser requests Tenant B

The request must not become authorized for Tenant B.

Identity

Verify returned:

userId
tenantId
role

come from server-side authenticated state and membership.

14. Database Requirements

If new Prisma models are required:

update schema.prisma
create a new migration
never rewrite historical migrations
preserve existing data
add appropriate unique constraints/indexes
maintain tenant isolation

Potential constraints should prevent duplicate membership relationships.

Use the project's existing migration conventions.

15. Seed / Development

If development seed data requires an admin user/membership:

clearly mark it as development-only
do not create production authentication shortcuts
do not hardcode production credentials
do not make tenant existence imply admin access
16. Security Rules

Never:

trust browser tenantId for authorization
trust browser userId
trust browser role
infer ADMIN from tenant existence
hardcode ADMIN
create fake sessions
expose tokens
expose secrets
bypass authentication for convenience
add authentication logic to client components
17. Out of Scope

Do not implement:

Feature 07 approval workflow
Google review publishing
Google reply automation
Pub/Sub
queues
workers
cron
analytics
billing
sentiment analysis
microservices
unnecessary RBAC systems
unnecessary organization hierarchy
unnecessary OAuth providers
18. Verification

Run:

npm run lint
npm run type-check
npm run test
npm run build
npm run db:generate

Run Prisma validation/migration checks where possible.

If a real DATABASE_URL is unavailable:

do not fabricate successful live migration validation
report the limitation
19. Completion Criteria

This feature is complete only when:

a real authenticated user can be resolved server-side
tenant membership is persisted
ADMIN authorization is verified
requireTenantAdmin no longer treats tenant existence as authentication
authenticated userId is available
authenticated tenantId is available
cross-tenant access is rejected
browser-supplied tenant/user identity cannot bypass authorization
tests verify the actual authorization boundary
lint passes
type-check passes
tests pass
build passes
Prisma generation passes
migration/schema state is consistent
20. Final Boundary

The completed architecture must provide:

Authenticated User
        ↓
Tenant Membership
        ↓
ADMIN Authorization
        ↓
requireTenantAdmin()
        ↓
{ userId, tenantId, role }
        ↓
Feature-specific domain service

Feature 07 will consume this boundary later.

Do not mark Feature 07 complete as part of this feature.


## 2. Then use a separate VS Code AI session

This is important given the workflow you're using. Start a **fresh chat/session** and give the coding agent this prompt:

```text id="3q5w7a"
Implement the Authentication & Tenant Membership Foundation.

This is a NEW isolated development task.

Read these files first, in order:

1. AGENTS.md
2. context/project-overview.md
3. context/architecture.md
4. context/ui-context.md
5. context/code-standards.md
6. context/ai-workflow-rules.md
7. context/progress-tracker.md
8. context/feature-specs/00-auth-tenant-membership.md

Then inspect the actual repository before making changes.

IMPORTANT:
Do not rely on previous AI reports.
Inspect the current code.

==================================================
PRIMARY OBJECTIVE
==================================================

Establish a REAL server-side authentication + tenant membership authorization boundary.

The current problem is that requireTenantAdmin can resolve a tenant and effectively assume ADMIN without establishing an authenticated user.

That must be fixed at the architectural boundary.

The final authorization flow must be:

authenticated session
        ↓
authenticated user
        ↓
tenant membership
        ↓
ADMIN role
        ↓
authorized tenant
        ↓
requireTenantAdmin()
        ↓
{ userId, tenantId, role }

==================================================
FIRST: INSPECT BEFORE IMPLEMENTING
==================================================

Inspect:

- package.json
- existing auth files
- domains/auth
- existing requireTenantAdmin implementation
- Prisma schema
- all Tenant-related models
- existing migrations
- Feature 04 auth boundary
- Feature 06 auth boundary
- Feature 07 implementation
- tests related to auth
- existing error conventions

Determine whether an actual authentication/session provider already exists.

DO NOT invent one if one already exists.

==================================================
AUTHENTICATION
==================================================

If an existing production authentication/session provider exists:

- reuse it
- follow existing conventions
- do not replace it

If no provider exists:

DO NOT fabricate:

- fake sessions
- fake user IDs
- hardcoded admin users
- browser-based authentication
- tenant-existence-as-authentication

Instead, determine the smallest architecture-consistent authentication foundation required.

If an external authentication provider is genuinely required but cannot be safely configured from repository context, document the exact blocker rather than pretending authentication is implemented.

==================================================
USER + TENANT MEMBERSHIP
==================================================

Establish persisted user identity and tenant membership where required.

Conceptually:

User
  ↓
TenantMembership
  ↓
Tenant

Membership must include at minimum:

- user
- tenant
- role

ADMIN must be a real membership role.

Tenant existence alone must NEVER grant ADMIN access.

Use existing naming/conventions where possible.

Do not invent unnecessary RBAC complexity.

==================================================
requireTenantAdmin
==================================================

Make requireTenantAdmin perform real authorization.

It must:

1. Resolve authenticated user/session.
2. Reject unauthenticated requests.
3. Resolve membership.
4. Verify requested tenant is actually accessible to that user.
5. Verify ADMIN role.
6. Return authenticated identity.

Conceptually:

const admin = await requireTenantAdmin(...)

admin.userId
admin.tenantId
admin.role

The userId must originate from authenticated server-side identity.

The tenantId must originate from validated membership.

Neither may be trusted from browser input.

==================================================
TENANT ISOLATION
==================================================

Explicitly test:

User A → Tenant A → ADMIN
User A → Tenant B → no membership

User A must not access Tenant B.

Also test:

authenticated tenant = Tenant A
browser requested tenant = Tenant B

The browser request must NOT switch authorization to Tenant B.

==================================================
SECURITY
==================================================

Never expose:

- access tokens
- refresh tokens
- session secrets
- OAuth secrets
- encryption secrets
- database credentials

Never put authorization decisions solely in client components.

Never trust:

- browser userId
- browser role
- browser tenantId
- hidden form fields
- localStorage

==================================================
FEATURE 07
==================================================

Do NOT implement Feature 07.

Do not implement:

- approval workflow changes
- Google publishing
- reply automation
- queues
- workers
- cron
- Pub/Sub
- Feature 08

Only make the minimum compatibility changes necessary so Feature 07 can consume the new authentication boundary later.

Do not fake approvedById.

==================================================
DATABASE
==================================================

If schema changes are necessary:

- update schema.prisma
- create a NEW migration
- do not rewrite historical migrations
- preserve existing data
- add appropriate indexes/unique constraints
- maintain tenant isolation

==================================================
TESTING
==================================================

Tests must exercise the authorization boundary, not just mock the result of it.

Cover:

1. unauthenticated user rejected
2. authenticated user resolved
3. user ID comes from authenticated identity
4. valid membership accepted
5. missing membership rejected
6. non-admin rejected
7. admin accepted
8. cross-tenant access rejected
9. browser tenant cannot override authenticated tenant
10. returned userId/tenantId/role are authoritative server-side values

Add regression coverage for existing auth behavior.

==================================================
VERIFICATION
==================================================

Run:

npm run lint
npm run type-check
npm run test
npm run build
npm run db:generate

Run Prisma validation/migration checks where possible.

If DATABASE_URL is unavailable, state that honestly.

==================================================
SCOPE DISCIPLINE
==================================================

Do not perform unrelated refactors.

Do not mass rewrite files.

Do not change UI unless absolutely required by the authentication architecture.

Do not modify unrelated Feature 06 behavior.

Do not modify historical migrations.

==================================================
PROGRESS TRACKER
==================================================

Update:

context/progress-tracker.md

Only after the implementation state is actually known.

Do not mark Feature 07 complete.

Clearly record the Auth/Tenant Membership Foundation status.

==================================================
GIT
==================================================

Do NOT commit.

Do NOT push.

Inspect git diff and git status at the end.

Only intended authentication, tenant membership, schema/migration, tests, and context files should be changed.

==================================================
FINAL REPORT
==================================================

Report:

1. Authentication architecture discovered
2. Authentication/session implementation
3. User model
4. Tenant membership model
5. requireTenantAdmin behavior
6. Tenant isolation
7. Tests added/changed
8. Database/migrations
9. Verification results
10. Remaining limitations
11. Git status

If genuine authentication is fully implemented and verified:

END WITH:

READY FOR AUDIT

If authentication remains blocked or incomplete:

END WITH:

NEEDS FIXES