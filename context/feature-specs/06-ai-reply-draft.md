# Feature 06 — AI-Assisted Google Review Reply Draft

## 1. Purpose

Implement AI-assisted reply drafting for reviews already synchronized into the
tenant's Google Business Profile review inbox.

The feature must generate a suggested reply draft that an authenticated tenant
admin can review and edit.

The generated reply is only a draft.

It must never be published to Google by Feature 06.

---

## 2. Scope

### In scope

- Generate an AI reply draft for an existing GoogleReview.
- Use the existing provider-agnostic AI boundary.
- Keep AI credentials server-side.
- Persist the generated draft separately from GoogleReview.
- Allow an authenticated tenant admin to view the draft.
- Allow the admin to edit the draft.
- Allow the admin to regenerate the draft.
- Clearly identify AI-generated content.
- Ground the draft only in data available on the stored GoogleReview.
- Maintain strict tenant isolation.
- Add focused automated tests.
- Add the required Prisma migration.
- Add the admin UI necessary for this feature.
- Update the progress tracker.

### Explicitly out of scope

Do NOT implement:

- Google reply publishing.
- Google reply updateReply calls.
- Google reply deletion.
- Automatic replies.
- Reply approval workflows.
- Scheduled replies.
- Pub/Sub.
- Queues.
- Cron jobs.
- Background workers.
- Sentiment manipulation.
- Review gating.
- Review suppression.
- Fake reviews.
- Customer-facing Google review posting.
- Analytics.
- Billing.
- Feature 07.
- Feature 08.
- Microservices.

---

## 3. Existing Architecture

Respect the existing repository architecture.

Relevant boundaries:

    domains/
      ai/
      google/
      reviews/
      auth/

Feature 05 already provides:

- GoogleReview persistence.
- Google review synchronization.
- Tenant-scoped review queries.
- Google review inbox.
- Authenticated admin access.

Feature 04 already provides:

- Google Business Profile connection.
- Google OAuth.
- Server-side credential handling.
- Tenant administration boundary.

Do not duplicate those systems.

Reuse existing authentication and tenant isolation mechanisms.

---

## 4. Authentication and Authorization

Every AI reply draft operation is admin-only.

Use the existing:

    requireTenantAdmin()

The tenant must come from the authenticated session.

Never trust:

- tenantId supplied by the browser.
- tenant slug supplied by the browser.
- Google account IDs supplied by the browser.
- Google location IDs supplied by the browser.

A request must be rejected when:

- the user is unauthenticated.
- the authentication token is invalid.
- a public feedback token is supplied.
- the authenticated tenant does not own the requested GoogleReview.

A tenant admin must never be able to generate, read, update, or regenerate a
draft belonging to another tenant.

Add explicit authorization tests.

---

## 5. Review Data Boundary

The AI system may receive only the minimum GoogleReview information needed
to generate a useful reply.

Permitted input includes:

- reviewer display name, when available.
- star rating, when available.
- review comment, when available.
- existing reply information, when useful.
- review metadata required by the prompt.

Do NOT send:

- Google OAuth access tokens.
- Google refresh tokens.
- encrypted credentials.
- tenant secrets.
- database credentials.
- unrelated tenant data.
- internal authentication information.

The AI provider must not have access to Google credentials.

---

## 6. Grounding Rules

The generated reply must be grounded strictly in the actual review.

The AI must not invent:

- products.
- services.
- prices.
- employees.
- discounts.
- guarantees.
- locations.
- timelines.
- business policies.
- customer history.
- facts not present in the supplied review context.

If the review contains insufficient information, the reply should remain
generic and appropriate rather than inventing details.

The system must never fabricate a customer experience.

---

## 7. Reply Tone

The default generated reply should be:

- concise.
- professional.
- polite.
- natural.
- appropriate for a business replying publicly.
- proportional to the review.
- non-promotional unless the review itself supports mentioning something.
- respectful of negative or mixed feedback.

For positive reviews, a simple genuine thank-you is acceptable.

For negative reviews, acknowledge the customer's experience without arguing,
blaming, or inventing corrective actions.

For mixed reviews, acknowledge the positive and negative portions when
appropriate.

For reviews without comments, the reply should remain generic and should not
invent what the customer liked.

Do not force every reply into the same wording.

---

## 8. AI Provider Boundary

Use the existing provider abstraction.

Business logic must not depend directly on a specific AI vendor.

Conceptually:

    AIProvider
        ↓
    generateReplyDraft(input)
        ↓
    normalized result

If the repository already contains an AIProvider interface, extend it only
as necessary.

Do not introduce a vendor-specific dependency into the review domain.

A mock provider must be available for tests.

The mock provider must be deterministic and must use the supplied review data.

Do not use a static positive response that ignores the review.

---

## 9. Prompt Isolation

Keep the reply-generation prompt separate from business logic.

For example:

    domains/ai/prompts/
        review-reply.ts

or the repository's existing equivalent prompt boundary.

The prompt should explicitly instruct the model:

- respond only to the supplied review.
- do not invent facts.
- do not mention internal systems.
- do not mention AI.
- keep the response concise.
- produce only the reply text.
- do not include markdown unless explicitly required.
- do not include quotation marks around the reply.

The exact provider API call belongs inside the AI provider implementation,
not inside the server action or page component.

---

## 10. Data Model

Introduce a separate persisted entity for the draft.

Suggested model:

    model ReviewReplyDraft {
      id                String   @id @default(cuid())
      tenantId          String
      googleReviewId    String
      content           String
      provider          String?
      model             String?
      createdAt         DateTime @default(now())
      updatedAt         DateTime @updatedAt

      tenant             Tenant      @relation(...)
      googleReview       GoogleReview @relation(...)

      @@index([tenantId])
      @@index([tenantId, googleReviewId])
    }

The exact relation syntax must follow the existing Prisma schema.

Tenant isolation must be represented in the database model.

A GoogleReview must not be able to reference a draft belonging to another
tenant.

Consider whether one current draft per review or draft history is appropriate.
Do not invent a history requirement if the existing architecture does not
need it.

For the initial implementation, a single current draft per review is
preferred unless the existing schema makes that unsuitable.

If using one current draft:

    @@unique([tenantId, googleReviewId])

---

## 11. Draft Lifecycle

The lifecycle is:

    GoogleReview
        ↓
    Generate draft
        ↓
    ReviewReplyDraft
        ↓
    Admin edits
        ↓
    ReviewReplyDraft updated
        ↓
    Feature 07 may later use the approved draft

Feature 06 must not publish the draft.

Regeneration replaces the current generated draft only according to the
chosen persistence design.

The original GoogleReview data must remain unchanged.

---

## 12. Generate Draft Operation

Expose a server-side operation for an authenticated tenant admin.

Input should identify the review safely.

Do not accept tenantId as an authorization mechanism.

Conceptually:

    generateReviewReplyDraft(reviewId)

The server must:

1. Authenticate the admin.
2. Resolve tenant from the authenticated session.
3. Load the review scoped to that tenant.
4. Validate that the review exists.
5. Build the minimal AI input.
6. Invoke the AI provider.
7. Validate the AI result.
8. Persist the draft scoped to the authenticated tenant.
9. Return only safe draft data.

Do not expose credentials or internal provider details unnecessarily.

---

## 13. Edit Draft Operation

Allow an authenticated admin to edit an existing draft.

Conceptually:

    updateReviewReplyDraft(draftId, content)

Authorization must verify:

    draft.tenantId === authenticatedTenant.id

The browser must not be able to change tenant ownership.

Validate content server-side.

Recommended initial maximum:

    1000 characters

The exact limit should be defined as a shared constant.

Do not silently truncate content.

Return a validation error when the limit is exceeded.

---

## 14. Regeneration

Allow the admin to regenerate a draft for the same review.

Regeneration must:

- authenticate the admin.
- resolve tenant from the session.
- load the tenant-scoped GoogleReview.
- invoke the AI provider again.
- replace/update the current draft.
- leave GoogleReview unchanged.

Do not allow regeneration for another tenant's review.

---

## 15. AI Failure Handling

AI failure must not corrupt the review or existing draft.

If generation fails:

- return a safe error.
- do not expose API keys.
- do not expose raw provider credentials.
- do not expose internal stack traces.
- preserve an existing draft if one already exists.

The admin UI should show a clear retry option.

---

## 16. AI Output Validation

AI output is untrusted input.

Validate:

- string type.
- non-empty content.
- maximum length.
- reasonable normalized content.

Reject malformed provider output.

Do not automatically publish malformed AI output.

---

## 17. Admin UI

Extend the existing Google review inbox.

For each review, provide an action such as:

    Generate Reply

When a draft exists, display:

- AI-generated indicator.
- draft content.
- Edit control.
- Save control.
- Regenerate control.

The UI should clearly distinguish:

    Google review
    Existing Google reply
    AI draft

An AI draft is not a Google reply.

The UI must not contain a "Publish to Google" action.

Do not imply that saving a draft sends anything to Google.

---

## 18. UI States

Handle:

- loading.
- generating.
- generated.
- editing.
- saving.
- regenerating.
- generation failure.
- save failure.
- validation failure.
- missing review.
- unauthorized access.

Prevent duplicate submissions while an operation is in progress.

---

## 19. Existing Google Reply

If the GoogleReview already contains an existing Google reply:

- display it as existing Google data.
- do not overwrite it.
- do not delete it.
- do not publish the AI draft over it.

Feature 06 may use the existing reply as context only if useful and appropriate.

The AI draft remains a separate entity.

---

## 20. Security

Never expose:

- Google access tokens.
- Google refresh tokens.
- encrypted credentials.
- AI API keys.
- DATABASE_URL.
- TOKEN_ENCRYPTION_SECRET.

AI credentials must remain server-side.

Do not place secrets in:

- client components.
- serialized props.
- browser responses.
- URL parameters.
- logs.

Do not log full customer review payloads unnecessarily.

---

## 21. Tenant Isolation Tests

Tests must explicitly prove:

### Unauthenticated

    anonymous request
        → rejected

### Public token

    public feedback token
        → rejected

### Tenant A

    authenticated Tenant A
        → can generate/read/update Tenant A draft

### Cross tenant

    authenticated Tenant A
        → cannot generate/read/update Tenant B draft

### Browser tenant manipulation

    authenticated Tenant A
    + tenantId=Tenant B
        → still operates only on Tenant A

### Review ownership

    Tenant A
    + Tenant B review ID
        → rejected

---

## 22. AI Safety Tests

Test that the provider receives only permitted review data.

Test that credentials are never passed to the AI provider.

Test that mock generation reflects supplied review information.

Examples:

- 5-star review with positive comment produces a positive thank-you draft.
- 1-star review with complaint produces an appropriate acknowledgment.
- review with no comment produces a generic response.
- fabricated facts are not inserted by the deterministic mock.
- existing review content remains unchanged.

---

## 23. Persistence Tests

Test:

- draft creation.
- draft update.
- draft regeneration.
- one current draft per review if using unique constraint.
- tenant isolation.
- review immutability.
- failure does not destroy an existing draft.

---

## 24. No Google Publishing

There must be no Feature 06 implementation of:

    updateReply

    deleteReply

or equivalent Google reply mutation calls.

Feature 06 is a draft-only feature.

Google publishing belongs to Feature 07.

---

## 25. No Automation

Do not add:

- cron.
- queues.
- workers.
- scheduled jobs.
- Pub/Sub.
- event consumers.

Generation is explicitly admin-triggered.

---

## 26. Migration

Create a real Prisma migration for the new ReviewReplyDraft model.

Do not rely only on:

    prisma db push

Migration must be committed with the feature.

Run:

    npm run db:generate

If a reachable PostgreSQL database is available, validate the migration against
it.

If database connectivity is unavailable, report that honestly.

Do not claim a migration was applied when it was not.

---

## 27. Testing

Add focused tests for:

- authentication.
- tenant authorization.
- review ownership.
- AI input grounding.
- AI provider abstraction.
- deterministic mock provider.
- draft generation.
- draft persistence.
- draft update.
- regeneration.
- AI failure.
- output validation.
- existing draft preservation.
- no Google publishing.
- credential safety.

Do not add live AI provider tests requiring external API credentials.

Do not add live Google API tests.

---

## 28. Verification

Before declaring the feature complete, run:

    npm run lint
    npm run type-check
    npm run test
    npm run build
    npm run db:generate

Also validate the Prisma migration if database connectivity is available.

Report:

- files changed.
- Prisma migration.
- tests added.
- total tests passing.
- lint result.
- type-check result.
- build result.
- Prisma generate result.
- migration validation result.
- git status.

---

## 29. Context Workflow

Before implementation:

1. Read AGENTS.md.
2. Read all context files required by AGENTS.md.
3. Read this feature specification.
4. Inspect Feature 04 and Feature 05 implementation.
5. Identify existing AI abstractions before creating new ones.

Update:

    context/progress-tracker.md

before and after implementation according to repository workflow.

If implementation reveals an architectural change, update the relevant context
document rather than silently diverging from it.

---

## 30. Scope Discipline

Implement the smallest complete vertical slice.

Do not:

- refactor unrelated code.
- rename unrelated files.
- rewrite existing Feature 04/05 code.
- change the Google OAuth architecture.
- change the feedback flow.
- implement Feature 07.
- implement Google reply publishing.
- implement automatic replies.

If ambiguity is discovered:

1. Follow existing architecture where clearly established.
2. Record the ambiguity.
3. Do not invent a broad new requirement.

Stop after Feature 06 is complete.