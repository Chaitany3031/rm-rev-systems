# Feature 03 — AI-Assisted Review Draft Generation

## 1. Purpose

Implement the AI-assisted review-draft experience for an existing customer feedback submission.

The feature converts saved customer feedback into an **AI-generated review draft** that the customer can inspect, edit, and copy.

The system must never automatically publish the review to Google.

### Core flow

```text
Existing FeedbackSubmission
        ↓
Generate AI Review Draft
        ↓
Display Draft
        ↓
Customer Edits Draft
        ↓
Customer Copies Draft
        ↓
Customer Independently Decides Whether To Publish
```

This feature is intentionally independent from Google Business Profile integration.

---

## 2. Scope

### In scope

* AI review-draft generation
* Provider-agnostic AI abstraction
* Server-side AI invocation
* Draft persistence
* Tenant isolation
* Loading/error/success states
* Editable review draft UI
* Copy-to-clipboard interaction
* Server-side validation
* Focused automated tests
* Safe error handling
* Progress-tracker update

### Out of scope

Do NOT implement:

* Google OAuth
* Google Business Profile API
* Google review publishing
* Automatic Google review posting
* Google review replies
* Automatic review replies
* Admin dashboard
* Prompt-management UI
* Analytics
* Billing
* Background queues
* Microservices
* AI chat
* Streaming responses
* Multiple AI-provider configuration UI

---

## 3. Existing Architecture

Continue using the existing Feature 01 and Feature 02 architecture.

Expected stack:

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui conventions
* Prisma
* PostgreSQL
* Zod
* Vitest/current project test setup

Follow the existing repository conventions instead of introducing a competing architecture.

The feature must remain part of the modular monolith.

---

## 4. Domain Boundary

The AI layer must be provider-agnostic.

Use a boundary conceptually equivalent to:

```ts
interface AIProvider {
  generateReviewDraft(input: ReviewDraftInput): Promise<ReviewDraftOutput>;
}
```

The exact implementation should follow existing project conventions.

The domain/application layer must depend on the abstraction, not directly on a specific AI vendor SDK.

Do not scatter provider-specific API calls throughout routes, actions, React components, or domain services.

---

## 5. AI Input

The AI generation service may receive:

* tenant/business name where appropriate
* selected service names
* overall rating
* customer's written feedback

The original feedback must remain the source of truth.

The AI must not invent specific facts about the customer's experience.

For example, the system should not invent:

* employee names
* prices
* delivery dates
* project details
* locations
* promises
* specific results
* services that were not selected

If the customer's written feedback is empty, the generated draft should remain appropriately generic and should not fabricate experience details.

---

## 6. Review-Draft Characteristics

The generated draft should be:

* natural
* concise
* professional
* based only on supplied information
* appropriate for a customer review
* editable
* clearly AI-generated

Avoid:

* exaggerated praise
* fabricated claims
* fake quotations
* invented details
* keyword stuffing
* manipulative language
* instructions telling the customer what rating to give
* language claiming the customer said something they did not provide

The system must not alter the customer's stored original feedback.

---

## 7. Data Model

Introduce a dedicated persisted model for the generated draft if one does not already exist.

Conceptually:

```text
ReviewDraft
---------
id
tenantId
feedbackSubmissionId
draft
createdAt
updatedAt
```

Use the repository's existing naming and Prisma conventions.

Requirements:

* A draft belongs to exactly one tenant.
* A draft references the source feedback submission.
* Tenant ownership must be verified server-side.
* The original `FeedbackSubmission` remains unchanged.
* Generated content must not overwrite the original feedback.

Whether multiple drafts are allowed per feedback submission should follow the simplest implementation compatible with the existing architecture. Do not introduce unnecessary versioning unless required by the current codebase.

---

## 8. Server-Side Generation

The browser must never directly call the AI provider.

The flow should be:

```text
Client
  ↓
Server Action / Route
  ↓
Validation
  ↓
Tenant + Feedback lookup
  ↓
AI Review Draft Domain Service
  ↓
AIProvider
  ↓
Validate output
  ↓
Persist ReviewDraft
  ↓
Return safe result
```

AI credentials must remain server-side.

Do not expose API keys through:

* client components
* public environment variables
* browser requests
* serialized page props

---

## 9. Validation

Validate all externally controlled input with Zod or the project's existing validation utilities.

At minimum:

* feedback submission identifier must be valid
* tenant/public-token relationship must be verified
* AI output must be a non-empty string
* generated draft must have a reasonable maximum length
* malformed AI responses must fail safely

Do not trust a feedback ID supplied by a client simply because it exists.

---

## 10. Public Access and Tenant Isolation

The customer-facing experience must continue using the public feedback token mechanism established in Feature 02.

A request for:

```text
tenant A + feedback belonging to tenant B
```

must never generate or retrieve tenant B's draft.

Do not expose sequential database identifiers as public authorization mechanisms.

The server must resolve and verify the tenant context before accessing the feedback.

---

## 11. UI Requirements

The customer-facing experience should fit naturally into the existing feedback flow.

### Draft state

Display:

* clear heading
* short explanation that the text was generated with AI
* editable text area
* Copy button

Example conceptual structure:

```text
Your review draft

We've created a draft based on your feedback.
You can edit it before using it.

┌─────────────────────────────────────┐
│ Editable AI-generated review text  │
│                                     │
└─────────────────────────────────────┘

[ Copy review ]
```

Do not make the generated text appear to be the customer's original submitted feedback.

---

## 12. UI States

Implement explicit states for:

### Initial

The user can request generation.

### Generating

Show a clear loading state.

Prevent accidental duplicate submissions while generation is in progress.

### Generated

Show the editable draft.

### Copy success

Provide clear confirmation that the draft was copied.

### Generation failure

Show a safe, human-readable error.

Do not expose:

* API keys
* provider errors
* stack traces
* internal database details
* implementation details

### Empty/missing feedback

Handle appropriately without crashing.

---

## 13. Editing

The customer must be able to edit the generated text locally.

Editing the draft must not modify the original:

```text
FeedbackSubmission.feedback
```

The generated draft and original feedback are separate concepts.

If the product persists customer edits, use the dedicated draft record.

Do not silently replace the original AI-generated value with the customer's original feedback.

---

## 14. Copy Behaviour

Provide a clear copy action using the browser Clipboard API where appropriate.

The UI should:

1. copy the currently edited draft
2. provide visible success feedback
3. gracefully handle clipboard failure

The copy operation does not publish anything publicly.

---

## 15. Public Publishing Boundary

Feature 03 must stop at:

```text
Customer has an editable review draft
```

The customer may independently decide what to do with it.

Do not:

* automatically open Google
* automatically submit to Google
* call Google APIs
* claim that the review was posted
* claim that publication succeeded
* create fake Google review records

Future Google integration must be implemented as a separate feature.

---

## 16. AI Provider Failure

AI availability must not make the feedback system unusable.

If generation fails:

* preserve the original feedback
* return a safe error
* allow the customer to retry
* do not create corrupt/empty draft records

The system should distinguish expected application errors from unexpected internal failures.

Unexpected failures should be logged using the project's existing logging conventions without exposing sensitive information to the customer.

---

## 17. Testing

Add focused tests for:

### Domain/application tests

* valid feedback generates a draft
* tenant isolation is enforced
* missing feedback returns the appropriate result
* nonexistent feedback is handled safely
* AI provider failure is handled
* invalid AI output is rejected
* generated draft is persisted
* original feedback remains unchanged

### Validation tests

* invalid identifiers
* invalid generated output
* excessive draft length where applicable

### UI tests

Test the important customer interactions where the current test setup supports them:

* generation loading state
* generated editable draft
* copy action
* copy success
* generation error

Do not create an enormous test suite unrelated to this feature.

---

## 18. Security and Privacy

Never send unnecessary customer data to the AI provider.

Do not send:

* authentication secrets
* Google OAuth credentials
* database credentials
* internal IDs unless technically required
* unrelated tenant information

Keep AI credentials server-side.

Do not log complete customer feedback unnecessarily.

Follow the project's existing environment-variable and secret-management conventions.

---

## 19. Architecture Rules

Keep responsibilities separated.

### Route/server action

Responsible for:

* receiving request
* basic boundary validation
* invoking application/domain service
* returning safe response

### Domain/application service

Responsible for:

* loading feedback
* tenant verification
* preparing AI input
* invoking `AIProvider`
* validating output
* persisting draft

### AI provider

Responsible only for:

* communicating with the configured AI provider
* converting provider response into the application's AI output contract

### React component

Responsible for:

* rendering
* user interaction
* loading/error/success state
* editing
* clipboard interaction

Do not place database queries or provider SDK calls inside React components.

---

## 20. Configuration

Use environment variables for provider configuration.

Do not hardcode:

* API keys
* model credentials
* secrets
* provider URLs

If Feature 01 already has environment validation, extend it consistently.

Do not introduce unnecessary provider configuration UI.

A development implementation may use a simple configured provider, but the application-level interface must remain provider-agnostic.

---

## 21. Prompt Boundary

Keep the review-generation prompt separate from business/domain logic.

The prompt should be treated as implementation/configuration rather than scattered string literals across components.

The prompt must instruct the AI to:

* use only supplied information
* avoid fabricated facts
* write from the customer's perspective
* produce a review draft rather than an internal explanation
* keep the output suitable for editing
* avoid claiming unprovided details

Do not build a prompt-management dashboard in this feature.

---

## 22. Existing Feature Compatibility

Do not rewrite Feature 02.

Reuse its:

* tenant resolution
* feedback retrieval
* service relationships
* validation conventions
* public-token flow
* UI conventions
* error handling patterns

Only make compatibility changes when strictly required by Feature 03.

---

## 23. Progress Tracker

Before implementation:

* read `context/progress-tracker.md`
* update it according to the repository's established workflow

After implementation:

* mark Feature 03 appropriately
* record actual verification results
* record any genuine deviation or open issue

Never claim a command passed unless it actually passed.

---

## 24. Required Verification

Run:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

Also run any database generation/migration command required by the actual schema changes.

Do not claim success based on expected output.

---

## 25. Definition of Done

Feature 03 is complete only when:

* [ ] Existing feedback can be used as AI-generation input.
* [ ] AI access is behind a provider abstraction.
* [ ] AI credentials remain server-side.
* [ ] Tenant isolation is enforced.
* [ ] Generated draft is persisted separately from original feedback.
* [ ] AI output is validated.
* [ ] Customer can edit the draft.
* [ ] Customer can copy the draft.
* [ ] Copy feedback is visible.
* [ ] Loading/error/success states exist.
* [ ] Original customer feedback remains unchanged.
* [ ] No Google integration has been added.
* [ ] No automatic publishing has been added.
* [ ] Focused tests pass.
* [ ] Lint passes.
* [ ] Type-check passes.
* [ ] Build passes.
* [ ] Progress tracker is updated.

---

## 26. Non-Goals Reminder

This feature ends here:

```text
                    FEATURE 03
                         │
                         ▼
                Existing feedback
                         │
                         ▼
                  AI generation
                         │
                         ▼
                  Review draft
                         │
                         ▼
                 Customer edits
                         │
                         ▼
                  Customer copies
                         │
                         ▼
               Customer decides
                         │
                         X
              NO automatic posting
```

Google integration belongs to a later feature.
