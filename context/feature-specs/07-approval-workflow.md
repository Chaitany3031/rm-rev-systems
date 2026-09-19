# Feature 07 — AI Reply Approval Workflow

## Status

Planned

## Feature Goal

Introduce an explicit admin approval workflow for AI-generated Google review reply drafts.

Feature 06 introduced AI-generated reply drafts.

Feature 07 introduces the human review/approval boundary that determines whether a generated draft is approved for the next workflow stage.

An AI-generated reply must remain a draft until an authenticated tenant administrator explicitly approves it.

This feature must preserve the separation between:

- Google review data
- existing Google reply data
- AI-generated reply drafts
- approval state

Approval is a business workflow action.

Approval is NOT the same thing as publishing a reply to Google unless explicitly defined by this specification.

---

# 1. Scope

## In Scope

Feature 07 includes:

- Admin-only approval workflow for `ReviewReplyDraft`
- Approval state persistence
- Tenant-scoped approval operations
- Server-side authorization
- Valid approval state transitions
- Approve action
- Appropriate UI state in the existing Google Review Inbox
- Clear distinction between draft and approved draft
- Audit-friendly timestamps
- Server-side validation
- Tenant isolation
- Focused automated tests
- Prisma migration if persistence changes are required
- Integration with the existing Feature 06 reply-draft workflow

## Out of Scope

Feature 07 MUST NOT implement:

- automatic Google review replies
- automatic publishing to Google
- scheduled replies
- cron jobs
- queues
- workers
- Pub/Sub
- background processing
- Google reply automation
- AI reply generation changes
- AI provider replacement
- analytics
- billing
- sentiment analysis
- sentiment manipulation
- review gating
- fake reviews
- forcing customers to leave positive reviews
- customer-facing Google review publishing
- microservices
- Feature 08 functionality
- unrelated refactoring

Do not implement functionality belonging to later features.

---

# 2. Existing Architecture

The project is a Next.js + TypeScript modular monolith.

Existing architecture:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui conventions
- PostgreSQL
- Prisma
- Zod
- domain-oriented services
- provider abstractions
- server actions/routes
- tenant isolation

Relevant existing domains:

```text
domains/
├── auth/
├── ai/
├── google/
├── reviews/
├── feedback/
└── tenants/


Feature 04 owns Google Business Profile connection.

Feature 05 owns Google Review synchronization and inbox functionality.

Feature 06 owns AI reply draft generation and editing.

Feature 07 owns the approval workflow.

Do not duplicate responsibilities between these features.

3. Existing Feature 06 Relationship

Feature 06 provides:

GoogleReview
    ↓
ReviewReplyDraft
    ↓
AI-generated reply content

Feature 07 extends this workflow:

GoogleReview
    ↓
ReviewReplyDraft
    ↓
Approval Workflow
    ↓
Approved Draft

The original:

GoogleReview
ReviewReplyDraft

must remain intact.

Approval must not mutate the original Google review.

Approval must not silently modify the existing Google reply.

Approval must not call Google APIs unless a later specification explicitly requires that behavior.

4. Approval Model

The approval workflow must represent whether the current AI reply draft has been approved by an authorized tenant administrator.

Use the smallest appropriate persistence model.

Prefer extending the existing ReviewReplyDraft model if that is sufficient and consistent with the existing architecture.

Do not introduce a separate model merely for the sake of abstraction unless the existing schema/design requires it.

The implementation must preserve:

tenant ownership
draft ownership
approval timestamp
approving administrator identity where the existing auth model supports it

A reasonable representation may include fields equivalent to:

approvalStatus
approvedAt
approvedBy

However:

Do not blindly implement these exact field names if the existing project conventions or schema indicate a better equivalent.

The implementation must use the existing project architecture.

5. Approval States

Use only the states defined below.

DRAFT

The AI reply draft exists but has not been approved.

This is the initial state.

APPROVED

An authenticated tenant administrator has explicitly approved the current draft.

No other approval states should be introduced in Feature 07.

Do not add:

PENDING
REJECTED
PUBLISHED
FAILED
AUTO_APPROVED

unless explicitly required by a future specification.

6. State Transitions

Valid transition:

DRAFT → APPROVED

Invalid transitions include:

APPROVED → APPROVED

unless the implementation treats repeated approval as an explicitly idempotent operation according to existing project conventions.

Do not silently create a new approval event every time the button is clicked.

The server must enforce the intended lifecycle.

Approval must be atomic.

7. Approval Semantics

When an administrator approves a draft:

Authenticate the administrator.
Resolve the authenticated tenant.
Validate the supplied draft/review identifier.
Load the draft using authenticated tenant scope.
Confirm the draft belongs to the intended Google review.
Validate its current approval state.
Transition the draft to APPROVED.
Record approval metadata where supported.
Return only safe information to the client.

The response must not expose:

Google OAuth tokens
access tokens
refresh tokens
encrypted credentials
AI credentials
database credentials
provider secrets
internal authentication information
8. Tenant Isolation

Tenant isolation is a hard security boundary.

A browser-supplied tenant ID must never determine database scope.

The existing authentication pattern must be used.

Server actions should follow this general pattern:

const admin = await requireTenantAdmin(tenantId);

await domainOperation(
  admin.tenantId,
  ...
);

The browser-supplied tenant ID may be used only as an authentication lookup input.

All domain operations must use:

admin.tenantId

not the browser-supplied value.

The domain layer must independently enforce tenant scope.

9. Authorization Requirements

Only authenticated tenant administrators may approve drafts.

The following must be rejected:

Unauthenticated request

Result:

AuthorizationError

or the existing project equivalent.

Public feedback token

A public feedback token must not grant admin approval permissions.

Result:

AuthorizationError
Cross-tenant access

Tenant A must not be able to approve Tenant B's draft.

The domain query must include tenant scope.

Example:

where: {
  id: draftId,
  tenantId,
}

Do not:

where: {
  id: draftId,
}

and then trust the result.

10. Domain Service

Approval business logic belongs in the domain layer.

Do not put approval logic directly inside a React component.

Do not put database business logic directly inside the server action.

Preferred flow:

React UI
   ↓
Server Action
   ↓
Authentication
   ↓
Domain Service
   ↓
Prisma

The server action should be thin.

The domain service should own:

draft lookup
tenant isolation
state validation
approval transition
persistence
safe domain errors
11. Server Actions

Create or extend the existing review server-action boundary.

The action should:

Validate input with Zod.
Authenticate with requireTenantAdmin.
Use authenticated tenant ID.
Call the domain service.
Return a safe ActionResult.

Do not expose raw Prisma errors.

Do not expose internal stack traces.

Do not expose credentials.

Do not trust client-side approval state.

The server is authoritative.

12. Input Validation

All server-action input must be validated.

For example:

tenantId
draftId

must be validated according to existing project conventions.

Do not trust:

draft IDs
tenant IDs
approval state
review IDs

from the browser.

The client may request an action.

The server decides whether that action is valid.

13. Draft Integrity

Approval must not modify the AI-generated content.

The approved draft must preserve the exact content that was approved.

Do not silently regenerate the draft during approval.

Do not alter:

ReviewReplyDraft.content

as part of approval.

Approval should represent:

"This exact draft was approved."

not:

"Generate another draft and approve that."
14. Existing Draft Editing

Feature 06 allows administrators to edit AI reply drafts.

Feature 07 must define a clear relationship between editing and approval.

If an approved draft is edited, the approval must no longer represent the edited content.

Therefore, follow the existing project architecture and implement the safest lifecycle:

DRAFT
  ↓
Edit
  ↓
DRAFT
  ↓
Approve
  ↓
APPROVED

If the existing implementation allows editing after approval, an edit must invalidate the previous approval and return the draft to:

DRAFT

Do not allow an edited draft to remain incorrectly marked as approved.

This behavior must be enforced server-side.

15. Regeneration

Feature 06 supports regeneration.

Regeneration creates new draft content.

Therefore:

APPROVED
  ↓
Regenerate
  ↓
DRAFT

The previous approval must not remain attached to newly generated content.

The currently stored draft represents the current content.

Regeneration must reset approval state to DRAFT.

Do not preserve approval across regenerated content.

This is a critical integrity requirement.

16. Existing Google Reply

The existing Google reply must remain separate from the AI draft.

Example:

GoogleReview.replyComment

represents an existing Google reply.

ReviewReplyDraft.content

represents the AI-generated draft.

Approval does not mean:

GoogleReview.replyComment = ReviewReplyDraft.content

unless explicitly required by a later feature.

Do not modify the existing Google reply.

17. Google API Boundary

Feature 07 must not introduce Google publishing.

No calls to:

accounts.locations.reviews.updateReply

or equivalent publishing APIs should be introduced unless explicitly required by this specification.

There is no automatic reply behavior in Feature 07.

The Google provider remains responsible for Google API interaction.

The approval workflow remains independent of Google API credentials.

18. AI Boundary

Feature 06 owns AI generation.

Feature 07 does not generate AI content.

Do not:

call the AI provider during approval
modify AI prompts
add a second AI provider
send additional sensitive data to AI

Approval only changes workflow state.

19. Approval UI

Extend the existing Google Review Inbox.

Do not create a separate review-management UI.

Each review should clearly distinguish:

Google Review
Existing Google Reply
AI Reply Draft
Approval Status

Example conceptual UI:

AI Reply Draft

[ draft content ]

Status: Draft

[ Edit ] [ Regenerate ] [ Approve ]

After approval:

AI Reply Draft

[ approved content ]

Status: Approved
Approved: <timestamp>

[ Edit ]

The exact visual implementation must follow the existing UI context.

Do not introduce a "Publish to Google" button.

Do not imply that approval automatically publishes the reply.

20. UI State Requirements

The UI must support appropriate states.

Initial
Status: Draft
Approve
Approving
Approving...

The approve button must be disabled while the request is running.

Prevent accidental duplicate requests.

Success

Display:

Approved

and appropriate approval metadata if available.

Error

Display a safe user-facing error.

Do not display:

stack traces
database errors
credentials
internal implementation details
Already Approved

The UI must not imply that another approval is required.

The server remains authoritative even if the UI state is stale.

21. Editing Approved Drafts

If an approved draft is edited:

APPROVED
   ↓
Edit
   ↓
DRAFT

The approval metadata must be cleared or invalidated appropriately.

The UI must communicate that the modified content requires approval again.

Do not leave:

Status: APPROVED

on modified content.

22. Regenerating Approved Drafts

If an approved draft is regenerated:

APPROVED
   ↓
Regenerate
   ↓
DRAFT

The new generated content must require fresh approval.

Previous approval must not carry over.

23. Persistence

If schema changes are required:

Update:

prisma/schema.prisma

and create a new migration.

Do not edit previous migrations.

Do not reset the database.

Do not delete existing data.

Migration naming should follow the existing project convention.

The migration must be included in source control.

24. Database Integrity

The database should enforce appropriate relationships.

The approval state must belong to the same tenant as the draft.

If approval metadata references an administrator, use the existing authentication/user model if available.

Do not introduce a second user/identity system.

Use appropriate:

foreign keys
indexes
uniqueness constraints

according to the actual architecture.

25. Concurrency

Approval must be safe against duplicate requests.

Two simultaneous approval requests must not create contradictory states.

The implementation should use the database as the authoritative state.

The expected outcome is:

DRAFT → APPROVED

not multiple conflicting approvals.

If the draft is already approved when a second request arrives, handle it according to the project's error/idempotency conventions.

Do not create duplicate approval records unless explicitly required.

26. Error Handling

Use existing project errors.

Expected cases include:

Draft not found

Return the existing safe not-found error.

Wrong tenant

Return the same safe not-found behavior where appropriate.

Do not reveal that the resource exists in another tenant.

Invalid state

Return a safe validation/domain error.

Authentication failure

Return the existing authorization error.

Database failure

Return a safe server error.

Never expose:

SQL
Prisma internals
credentials
stack traces

to the browser.

27. Testing Requirements

Feature 07 must have focused automated tests.

Tests must cover both:

server action boundary

and:

domain service boundary

Do not rely only on mocked domain tests.

This is especially important because previous audits found that a server-action authentication bug can exist even when domain tests pass.

28. Required Authorization Tests

Test:

unauthenticated approval rejected
public feedback token rejected
authenticated tenant admin can approve own draft
Tenant A cannot approve Tenant B draft
browser tenant ID cannot override authenticated tenant
domain receives authenticated tenant ID
missing draft returns safe not-found
invalid draft ID is rejected
approved draft cannot be incorrectly re-approved
29. Required Lifecycle Tests

Test:

DRAFT → APPROVED

Test:

APPROVED + edit → DRAFT

Test:

APPROVED + regenerate → DRAFT

Test:

DRAFT + regenerate → DRAFT

Test that approval does not modify:

GoogleReview

Test that approval does not modify:

GoogleReview.replyComment

Test that approved content remains exactly the approved content.

30. Persistence Tests

Verify:

approval state is persisted
approval timestamp is persisted
tenant scope is persisted
approved draft can be retrieved
cross-tenant retrieval fails
migration/schema relationship works
31. Security Tests

Explicitly verify that AI credentials and Google credentials never reach:

client responses
browser state
approval actions
approval UI
AI input

Verify that approval responses contain only safe fields.

32. Regression Testing

Existing Feature 04, 05, and 06 tests must continue passing.

Run the entire test suite.

Do not weaken or remove existing tests to make Feature 07 pass.

Do not change security behavior of existing features without an explicit requirement.

33. Context Updates

Before implementation:

Update:

context/progress-tracker.md

to indicate that Feature 07 implementation has started.

After implementation:

Update the tracker with:

completed work
verification results
remaining external requirements
open questions if any

Do not claim external Google functionality is verified unless it has actually been tested.

34. Architecture Changes

If Feature 07 causes a material architecture change:

Update the relevant context document.

Examples:

context/architecture.md
context/code-standards.md

Do not update architecture documentation for trivial implementation details.

35. Scope Guard

Before finishing, search the codebase for accidental Feature 08 functionality.

Feature 07 must NOT contain:

automatic reply
auto reply
scheduled reply
cron
worker
queue
Pub/Sub
background job
automatic publish

unless an existing unrelated implementation legitimately contains those terms.

Investigate any newly introduced occurrences.

36. Google Publishing Guard

Search the Feature 07 changes for Google publishing calls.

Feature 07 must not introduce:

updateReply
deleteReply
publish

against Google Business Profile APIs.

Approval is a local workflow state.

It is not Google publication.

37. Recommended Domain Flow

The intended architecture is:

Admin UI
   ↓
approveReplyDraftAction()
   ↓
Zod validation
   ↓
requireTenantAdmin()
   ↓
authenticated tenant ID
   ↓
review/reply domain service
   ↓
tenant-scoped draft lookup
   ↓
state validation
   ↓
atomic approval transition
   ↓
safe response
   ↓
UI updates
38. Security Principle

The browser is untrusted.

The server is authoritative.

Never trust client-provided:

tenant
approval state
draft state
review ownership
user identity
authorization

The authenticated tenant and persisted database state determine whether an operation is valid.

39. Definition of Done

Feature 07 is complete only when:

Architecture
 Existing modular-monolith architecture preserved
 Domain logic remains in domain services
 Server actions remain thin
 Existing Feature 04–06 boundaries preserved
Authentication
 Admin authentication enforced
 Public tokens rejected
 Unauthenticated requests rejected
 Authenticated tenant ID used for domain operations
Tenant Isolation
 All approval queries tenant-scoped
 Cross-tenant approval blocked
 Browser tenant manipulation cannot override authenticated scope
Approval
 Draft can be explicitly approved
 Approval state persisted
 Approval metadata persisted where supported
 Invalid transitions rejected
 Duplicate approval handled safely
Draft Integrity
 Approval does not modify draft content
 Approval does not modify GoogleReview
 Approval does not modify existing Google reply
 Editing approved content requires fresh approval
 Regeneration requires fresh approval
Google
 No automatic publishing
 No automatic replies
 No new Google API publishing behavior
 Credentials remain server-side
AI
 No AI generation added to approval
 Existing AI provider boundary preserved
 No credentials sent to AI
UI
 Approval status clearly visible
 Approve action available only when appropriate
 Loading state implemented
 Success state implemented
 Error state implemented
 Draft and Google reply clearly distinguished
 No misleading Publish button
Database
 Prisma schema updated if necessary
 New migration created if necessary
 Existing migrations untouched
 Appropriate indexes/constraints present
Tests
 Server action authorization tests
 Domain authorization tests
 Cross-tenant tests
 Lifecycle tests
 Persistence tests
 Regression suite passes
Verification

Run:

npm run lint
npm run type-check
npm run test
npm run build
npm run db:generate

If database access is available, also validate the migration using the project's established migration workflow.

If database access is unavailable, explicitly report that live migration validation could not be performed.

40. Git Rules

The implementation agent must NOT commit.

The implementation agent must NOT push.

After implementation:

git status
git diff

must be inspected.

No unrelated files should be modified.

No temporary files should remain.

No secrets should be committed.

The agent must stop after implementation and verification.

Final response must end with:

READY FOR AUDIT

or:

NEEDS FIXES
41. Important Implementation Constraint

Do not assume that the exact field names, model structure, authentication shape, or service APIs described in this specification already exist.

Before changing code:

inspect the existing Prisma schema
inspect Feature 04
inspect Feature 05
inspect Feature 06
inspect existing authentication
inspect existing reply-draft lifecycle

Reuse existing abstractions wherever appropriate.

Do not duplicate existing functionality.

Do not invent missing infrastructure.

If a requirement is genuinely ambiguous, record it as an open question rather than silently inventing behavior.

42. Final Feature Boundary

Feature 07 ends at:

AI Reply Draft
       ↓
Human/Admin Approval
       ↓
APPROVED

It does NOT continue to:

APPROVED
       ↓
Google API
       ↓
Published Reply

That later behavior belongs to a separate feature and must not be implemented here.


### Put it here

```text
context/
└── feature-specs/
    ├── 01-foundation.md
    ├── 02-public-feedback.md
    ├── 03-ai-review-draft.md
    ├── 04-google-business-profile-connection.md
    ├── 05-google-review-sync.md
    ├── 06-ai-reply-draft.md
    └── 07-approval-workflow.md   ← this