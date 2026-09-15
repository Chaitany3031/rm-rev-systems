# Feature 02 — Public Customer Feedback Experience

**Status:** Planned
**Feature ID:** 02
**Depends on:** Feature 01 — Foundation
**Primary domain:** Feedback
**Secondary domain:** Tenants, Services
**User surface:** Public customer feedback flow

---

## 1. Goal

Implement the first real customer-facing vertical slice of RM Review Systems.

A customer must be able to open an opaque public feedback link for a tenant/business, view that business's active services, select the service(s) they received, provide one overall 1–5 rating, optionally provide written feedback, submit the feedback, and receive a clear success state.

The implementation must be production-oriented, accessible, mobile-first, multi-tenant-safe, and loosely coupled.

This feature should establish the domain boundaries and persistence model needed by later features without implementing those future features prematurely.

---

## 2. User Flow

The intended flow is:

```text
Customer opens public feedback link
        ↓
Resolve tenant/business from opaque public token
        ↓
Load tenant/business identity
        ↓
Load active services for that tenant
        ↓
Customer selects one or more services
        ↓
Customer gives one overall 1–5 rating
        ↓
Customer optionally writes feedback
        ↓
Customer submits
        ↓
Validate request
        ↓
Persist feedback submission
        ↓
Show success state
```

The customer should not need to create an account or authenticate for this flow.

---

## 3. Public Feedback URL

The public feedback endpoint/page must use the tenant's opaque public token.

Do not expose internal tenant IDs as the public identifier.

Example shape:

```text
/feedback/{publicToken}
```

The exact route may follow the existing Next.js project conventions, but the public identifier must remain the opaque token.

The implementation must:

* Resolve the tenant using the public token.
* Return a safe not-found state when the token is invalid.
* Never reveal internal database identifiers unnecessarily.
* Never expose private tenant configuration.
* Never expose authentication credentials or secrets.

---

## 4. Tenant / Business Identity

The public page should show enough information for the customer to understand whose feedback they are submitting.

At minimum:

* Business/tenant name.

Optional existing tenant description may be displayed if useful.

Do not invent:

* Logos
* Brand colors
* Contact information
* Addresses
* Social links
* Marketing claims

unless those fields already exist in the current implementation or are explicitly required elsewhere.

The exact visual brand system remains intentionally TBD.

---

## 5. Service Catalog

The feedback page must load services from tenant-owned data rather than hardcoding service conditionals into the UI.

The service catalog must support:

* Service ID
* Tenant ownership
* Service name
* Optional description
* Active/inactive state
* Stable ordering

The public customer should only see services that are active for the resolved tenant.

Services belonging to another tenant must never appear.

The initial RM Solution services are defined by the project/product context:

1. Website Development — Professional & Responsive Websites
2. CRM Software — Manage Leads, Customers & Sales
3. AI Chatbots — Smart Chatbots for Your Business
4. WhatsApp Automation — Automate & Grow Your Business
5. AI Voice Agents — Smart Voice Solutions
6. Business Automation — Save Time, Increase Productivity
7. Google Business Profile Setup & Optimization
8. Google Ads Management
9. Meta Ads (Facebook & Instagram Ads)

These should be represented as tenant/service data, not UI-specific hardcoded business logic.

The architecture should allow additional tenants to have different services later.

---

## 6. Service Selection

The customer must be able to select one or more services.

Requirements:

* At least one service must be selected before submission.
* Multiple services are allowed.
* Selection must be visually obvious.
* Selection must have an accessible non-color-only state.
* Keyboard users must be able to select/unselect services.
* Touch targets should be comfortable on mobile devices.
* The UI must not depend on hover.
* Invalid submission must clearly explain that a service is required.

Do not implement service-specific rating questions in this feature.

There is only one overall rating.

---

## 7. Overall Rating

The customer provides one overall rating from 1 through 5.

Requirements:

* Exactly one rating is submitted.
* Rating is required.
* Values outside 1–5 must be rejected server-side.
* The rating must be accessible to keyboard and assistive-technology users.
* The implementation must not rely on color alone.
* The selected state must be visually clear.
* The customer must understand what each rating represents.

A star-based UI is acceptable, but the underlying control must have an accessible semantic representation.

Do not implement:

* Per-service ratings
* Sentiment classification
* Automatic positive/negative routing
* Review gating
* Different flows based on rating
* Hidden rating manipulation

---

## 8. Written Feedback

Written feedback is optional.

Requirements:

* Customer can leave free-form feedback.
* Empty feedback is valid.
* Server-side validation must enforce a reasonable maximum length.
* The maximum must be defined as a shared validation constant rather than duplicated across UI/server code.
* Whitespace-only feedback should be normalized appropriately.
* Customer-entered text must not be silently rewritten before persistence.

Do not:

* Generate AI text.
* Rewrite customer feedback.
* Automatically turn feedback into a public Google review.
* Automatically publish anything to Google.

Those belong to later features.

---

## 9. Submission Model

Introduce a dedicated feedback submission domain model.

The persisted submission should capture, at minimum:

* Unique feedback submission ID
* Tenant association
* Overall rating
* Optional written feedback
* Creation timestamp
* Update timestamp if appropriate

Service selections must be persisted as relationships/data associated with the submission.

The data model must preserve which services the customer selected at submission time.

Do not rely only on the current service catalog to reconstruct historical submissions.

The schema should maintain tenant isolation through explicit relationships.

---

## 10. Submission Validation

Validation must happen on the server.

Client-side validation may be added for usability but must never be the only validation.

Required validation:

* Valid public tenant token
* At least one selected service
* Selected services belong to the resolved tenant
* Selected services are active
* Rating exists
* Rating is an integer between 1 and 5
* Feedback length does not exceed the configured maximum

Reject:

* Unknown service IDs
* Services belonging to another tenant
* Inactive services
* Invalid ratings
* Malformed requests
* Missing tenant
* Invalid public token

Do not trust tenant IDs or service ownership information supplied by the browser.

The server must derive tenant identity from the public token.

---

## 11. Persistence and Prisma

Use the existing Prisma/PostgreSQL foundation.

Add only the schema necessary for this feature.

The implementation should provide a usable database migration workflow.

If the existing foundation does not contain a committed migration yet, create the appropriate first migration when required by this feature and commit it.

Do not introduce unrelated future-domain schema.

Do not create models for:

* Google reviews
* Google OAuth
* AI providers
* AI generations
* Review drafts
* Admin dashboards
* Billing
* Analytics
* Notifications
* Queues/workers

unless absolutely required by the implementation of this feature.

---

## 12. Feedback Domain Boundary

Business logic for feedback submission should live in the feedback domain rather than inside the Next.js page/component.

Prefer a structure similar to:

```text
domains/
└── feedback/
    ├── ...
    ├── validation
    ├── service
    └── types
```

Exact filenames are implementation details.

The important boundary is:

```text
Next.js route/page/action
        ↓
Feedback application/service layer
        ↓
Validation
        ↓
Persistence
```

UI components must not directly contain database access.

Database code must not be scattered throughout React components.

---

## 13. Tenant and Service Boundaries

Tenant resolution and service catalog access should remain reusable.

Prefer:

```text
Public feedback entry point
        ↓
Tenant resolution
        ↓
Service catalog query
        ↓
Feedback submission service
```

Avoid embedding all business logic into one large route/page file.

The implementation should remain easy to extend for:

* Admin-managed service catalogs
* Additional tenants
* Future feedback analytics
* AI review generation

without implementing those systems now.

---

## 14. Public Security Requirements

This is an unauthenticated public flow.

Therefore:

* Treat all browser input as untrusted.
* Validate every submitted field server-side.
* Resolve tenant from the opaque public token.
* Verify every selected service against the resolved tenant.
* Do not accept a tenant ID from the browser as authoritative.
* Do not expose private tenant/user data.
* Do not expose database errors to customers.
* Do not expose stack traces.
* Do not log unnecessary customer content.
* Do not place secrets in client-side code.
* Do not expose Google credentials or AI provider credentials.

The implementation should use the existing error conventions from Feature 01.

---

## 15. Duplicate Submission / Abuse

Feature 02 should establish a reasonable baseline without introducing a full anti-abuse infrastructure.

Do not implement CAPTCHA, queues, third-party fraud systems, or complex rate-limiting infrastructure unless the existing foundation already provides it.

However, the submission service should be designed so that rate limiting or abuse protection can be added later without rewriting the domain model.

Do not invent an arbitrary customer identity system.

---

## 16. UI / UX

The customer experience should be:

* Trustworthy
* Modern
* Simple
* Professional
* Mobile-first
* Low-friction
* Accessible

Avoid:

* Dark patterns
* Pressure to leave positive feedback
* Manipulative copy
* Excessive animation
* Dense dashboard-like layouts
* Unnecessary multi-step complexity

### Required UI states

Implement clear states for:

1. Loading
2. Valid feedback page
3. Invalid/not-found feedback link
4. Empty service catalog
5. Validation errors
6. Submission loading
7. Successful submission
8. Unexpected submission failure

The page should preserve customer-entered feedback if a submission attempt fails validation or encounters a recoverable error.

---

## 17. Success State

After successful persistence, do not redirect the customer into Google review publishing.

Show a clear confirmation that their feedback was received.

The success state may explain that their feedback has been submitted.

Do not imply that:

* A Google review was posted.
* A public review was created.
* The feedback will definitely become a public review.
* The customer must post publicly.

Public review generation/publishing is a separate future workflow.

---

## 18. Accessibility

Use semantic HTML and accessible form controls.

Requirements:

* Proper labels
* Keyboard navigation
* Visible focus states
* Accessible service selection
* Accessible rating control
* Error messages associated with relevant controls
* Status/success messages understandable without animation
* Sufficient contrast using the project's existing styling conventions
* No color-only meaning

Do not introduce an elaborate accessibility abstraction layer unless needed.

---

## 19. Responsive Design

The page must work well on:

* Mobile
* Tablet
* Desktop

Prioritize mobile because the feedback link will commonly be opened from a phone or QR code.

Avoid unnecessary horizontal scrolling.

Service selection should remain comfortable when the service catalog contains several items.

---

## 20. Visual Design Constraints

Do not invent a complete brand system in Feature 02.

The current UI context intentionally leaves these TBD:

* Exact brand colors
* Typography system
* Icon system
* Detailed spacing scale
* RM Solution brand assets

Use the existing Tailwind/shadcn foundation consistently.

Only introduce additional visual primitives when required by this feature.

Keep the implementation easy to restyle later.

---

## 21. Error Handling

Use the shared error conventions from Feature 01.

Customer-facing errors should be:

* Safe
* Clear
* Actionable where possible

Never display raw:

* Prisma errors
* SQL errors
* Stack traces
* Internal IDs
* Provider credentials
* Infrastructure details

Unexpected errors should be logged using the project's established approach while returning a generic safe message to the customer.

---

## 22. Testing

Add automated tests covering the important domain behavior.

At minimum test:

### Tenant resolution

* Valid public token resolves the correct tenant.
* Invalid token does not resolve a tenant.

### Service loading

* Only active services for the resolved tenant are returned.
* Services from another tenant are excluded.
* Inactive services are excluded.

### Submission validation

* Missing service selection is rejected.
* Empty service selection is rejected.
* Missing rating is rejected.
* Rating below 1 is rejected.
* Rating above 5 is rejected.
* Non-integer rating is rejected.
* Excessively long feedback is rejected.
* Valid optional feedback is accepted.
* Whitespace-only feedback is normalized appropriately.

### Tenant isolation

* A service ID belonging to another tenant cannot be submitted.
* An inactive service cannot be submitted.

### Persistence

* Valid feedback submission persists the expected tenant, rating, feedback, and selected services.

### UI / smoke coverage

Add an appropriate test for the public feedback entry point if the existing testing setup supports it without introducing unnecessary infrastructure.

Do not create a large end-to-end testing framework solely for this feature.

---

## 23. Seed Data

If the project seed workflow is used, provide enough development data to make the public feedback flow testable locally.

The seed should include:

* One development tenant representing RM Solution.
* The initial RM Solution service catalog listed in this specification.

Do not seed fake customer feedback unless it is genuinely useful for testing.

Do not add production secrets to seed data.

---

## 24. API / Server Boundary

The exact Next.js implementation mechanism is intentionally left to the coding agent.

Possible approaches include:

* Server Actions
* Route Handlers
* Server-side application functions

Choose the approach that best matches the existing Feature 01 architecture.

Regardless of implementation choice:

* UI must not directly access Prisma.
* Validation must occur at the server boundary.
* Domain/application logic must remain testable.
* Public input must be treated as untrusted.
* Errors must follow existing conventions.

---

## 25. Out of Scope

The following are explicitly NOT part of Feature 02:

* AI review generation
* AI provider integration
* AI prompt management
* Google OAuth
* Google Business Profile integration
* Google review synchronization
* Google review publishing
* Automatic Google replies
* Admin review inbox
* Admin dashboard
* Tenant admin UI
* Authentication flows
* Role management
* Billing
* Analytics
* Email notifications
* WhatsApp notifications
* SMS
* CAPTCHA
* Advanced anti-fraud systems
* Queues/workers
* Background jobs
* Microservices
* Service-specific questions
* Per-service ratings
* Sentiment routing
* Review gating
* Automatic public review creation
* Automatic public review publishing

If implementation reveals a requirement for one of these systems, stop and record it as an open question rather than implementing it speculatively.

---

## 26. Architecture Rules

Follow the project-wide architecture rules.

Specifically:

* Keep the application modular.
* Keep domain logic out of UI components.
* Keep database access behind appropriate server/domain boundaries.
* Prefer small modules with single responsibilities.
* Avoid premature abstractions.
* Avoid speculative infrastructure.
* Avoid unrelated refactors.
* Do not rewrite Feature 01 unless a concrete Feature 02 requirement makes it necessary.
* Preserve multi-tenancy.
* Preserve server-side secret boundaries.
* Prefer dependency injection or clear provider boundaries where appropriate.
* Keep future AI/Google integrations decoupled from feedback submission.

---

## 27. Open Questions

The following should remain open unless existing project context already answers them:

* Exact production rate-limit strategy.
* Exact production abuse-prevention strategy.
* Exact authentication provider for future authenticated users/admins.
* Exact visual brand tokens.
* Exact hosting/database provider.
* Exact observability provider.
* Exact AI provider/model.
* Exact Google API onboarding/approval configuration.

Do not resolve these by invention during Feature 02.

---

## 28. Definition of Done

Feature 02 is complete when:

1. A valid opaque public feedback token opens the correct tenant feedback page.
2. Invalid tokens produce a safe not-found experience.
3. The tenant/business identity is displayed.
4. Active tenant services are loaded from data.
5. Customer can select one or more services.
6. Customer can provide exactly one overall 1–5 rating.
7. Customer can optionally provide written feedback.
8. Server validates all submission data.
9. Server verifies service ownership and active state.
10. Valid submissions persist correctly.
11. Selected services are preserved historically.
12. Successful submission shows a clear confirmation.
13. No Google/AI/public-review action happens automatically.
14. Tenant isolation is enforced.
15. UI is responsive and accessible.
16. Loading, empty, error, and success states exist.
17. Automated tests cover the core domain behavior.
18. Lint passes.
19. Type-check passes.
20. Tests pass.
21. Production build passes.
22. README/context documentation is updated where necessary.
23. `context/progress-tracker.md` reflects the actual implementation state.
24. No unrelated features or speculative infrastructure were added.
25. The final diff is limited to Feature 02 and necessary supporting changes.

---

## 29. Required Verification

Before declaring the feature complete, run:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

If database changes were made, also verify the appropriate Prisma workflow, including generation and migration validation.

The coding agent must report the actual command results.

Do not claim a check passed unless it was actually run.

---

## 30. Progress Tracker Requirement

Before implementation:

* Mark Feature 02 as `In Progress`.
* Record the implementation plan briefly.

After implementation:

* Mark Feature 02 as `Completed` only if all Definition of Done requirements are satisfied.
* Record the actual verification results.
* Record any unresolved decisions under deferred/open decisions.
* Record the next feature as Feature 03 only after Feature 02 is genuinely complete.

Do not mark work complete based only on code generation.

---

## 31. Implementation Principle

Build the smallest complete vertical slice that works end-to-end:

```text
Public token
    ↓
Tenant
    ↓
Active services
    ↓
Customer selection
    ↓
Overall rating
    ↓
Optional feedback
    ↓
Validated server submission
    ↓
Database
    ↓
Success state
```

Do not build the rest of the product during this feature.
