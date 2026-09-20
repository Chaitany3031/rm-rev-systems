# Implementation Prompt — Customer Feedback Experience

## Goal

Turn the existing public feedback route into a polished, production-ready customer experience while preserving the locked product behavior and existing server/domain contracts.

## User-visible outcome

A customer opening `/feedback/[publicToken]` should be able to:

1. Understand which business they are giving feedback to.
2. Select one or more services they actually received.
3. Give one overall 1–5 rating.
4. Optionally write detailed feedback.
5. Submit once with clear loading/error/success states.
6. See an AI-assisted review draft grounded only in their submitted information.
7. Edit the draft.
8. Copy the draft.
9. Understand that the draft is AI-generated and that public posting remains their choice.
10. Start another response.

The experience must work well on mobile and desktop and remain accessible.

## Context/specs read

- `AGENTS.md`
- `context/project-overview.md`
- `context/architecture.md`
- `context/ui-context.md`
- `context/code-standards.md`
- `context/ai-workflow-rules.md`
- `context/progress-tracker.md`
- Existing Feature 02 and Feature 03 implementation

## Existing code inspected

- `app/feedback/[publicToken]/page.tsx`
- `app/feedback/[publicToken]/feedback-form.tsx`
- `app/feedback/[publicToken]/actions.ts`
- Existing feedback and review domain services
- Existing shadcn/ui primitives

## Decisions

- Keep the existing public route.
- Keep tenant resolution through the opaque public token.
- Keep service definitions data-driven.
- Keep one overall rating per submission.
- Keep written feedback optional.
- Keep AI review generation after successful persistence.
- Keep customer control over editing/copying/public publishing.
- Do not introduce review gating.
- Do not automatically publish to Google.
- Do not add admin functionality to this feature.
- Do not replace the existing server/domain architecture with client-side business logic.

## Likely files to change

- `app/feedback/[publicToken]/page.tsx`
- `app/feedback/[publicToken]/feedback-form.tsx`
- Relevant reusable UI components only if required
- Tests covering the public feedback flow

Do not change Prisma schema or migrations unless an existing acceptance criterion proves a schema change is necessary.

## UX requirements

### Layout

- Mobile-first single-column flow.
- Constrain content width for comfortable reading.
- Clear business identity at the top.
- Visually distinct steps/sections without making the flow feel like a long form.
- Comfortable touch targets.
- Strong primary action.
- Responsive desktop spacing.

### Service selection

- Use clear selectable cards/buttons.
- Selected state must be obvious without relying only on color.
- Show service name and description.
- Preserve keyboard accessibility.
- Allow multiple selections.

### Rating

- Accessible 1–5 star control.
- Keyboard-operable.
- Screen-reader labels must communicate the numeric rating and meaning.
- Show the selected rating in text.
- Do not manipulate the user toward a positive rating.

### Written feedback

- Clearly optional.
- Show character count.
- Preserve entered text on validation failure.
- Give useful validation feedback.

### Submission

- Disable duplicate submission while pending.
- Show progress state.
- Preserve the user's input when a server error occurs.
- Use safe, understandable errors.

### AI draft

- Clearly label it as AI-assisted.
- Make the text editable.
- Preserve user edits.
- Provide copy feedback.
- Provide retry/regenerate behavior without losing the saved feedback.
- Do not imply the generated text is a verbatim customer statement.
- Explain that the customer can edit before using it publicly.
- Do not add a misleading automatic-publish button.

### Empty/error states

Handle:
- invalid/inactive public token
- tenant with no active services
- feedback submission failure
- AI generation failure
- clipboard failure

## Security

- Keep all business logic server-side.
- Keep public token validation server-side.
- Do not expose internal tenant identifiers unnecessarily.
- Do not expose credentials or Google tokens.
- Preserve existing tenant isolation.
- Do not weaken server-side validation.
- Do not log customer feedback contents unnecessarily.

## Acceptance criteria

- Public feedback route loads for a valid seeded tenant.
- Invalid token renders a safe not-found state.
- Active services are rendered from tenant data.
- Customer can select multiple services.
- Customer can select exactly one overall rating from 1–5.
- Written feedback is optional and length-limited.
- Invalid submission is rejected with understandable feedback.
- Successful submission persists feedback and transitions to the draft state.
- AI draft generation remains tenant-scoped and grounded.
- AI failure does not lose persisted feedback.
- Draft remains editable.
- Copy action provides success/failure feedback.
- No public review is automatically published.
- Keyboard navigation works for service and rating controls.
- Mobile layout is usable without horizontal scrolling.
- Loading, error, empty, and success states are implemented.
- Existing domain and authorization tests continue to pass.

## Verification

Run:

```bash
npm run test
npm run lint
npm run type-check
npm run build
npm run db:generate
```

For browser verification, test:

```
/feedback/rm-solution-dev
```

Verify:
1. service selection
2. rating selection
3. validation
4. submission
5. AI loading state
6. generated draft
7. edit draft
8. copy draft
9. retry behavior
10. submit another response

## Explicitly out of scope

- Google review publication
- automatic Google replies
- review gating
- sentiment-based routing
- admin dashboard
- analytics
- billing
- queues/workers
- new external providers
- Prisma schema changes
- unrelated refactors
