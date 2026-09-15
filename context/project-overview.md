# Project Overview

## Project name

RM Review Systems

## Purpose

Build a reusable customer feedback and review-assistance system, starting with RM Solution as the first client/business. The system should collect authentic customer feedback, generate an editable AI-assisted review draft, and provide a safe handoff for the customer to publish a review themselves.

## Business context

RM Solution provides:

- Website Development
- CRM Software
- AI Chatbots
- WhatsApp Automation
- AI Voice Agents
- Business Automation
- Google Business Profile Setup & Optimization
- Google Ads Management
- Meta Ads

## Core customer flow

1. Customer opens a client-specific feedback link or QR code.
2. Customer sees the client's service catalog.
3. Customer selects one or more services.
4. Customer provides an overall 1–5 star rating and optional written feedback.
5. The system stores the submitted feedback.
6. AI may create a review draft from the structured input and customer wording.
7. Customer can edit the draft before using it.
8. Customer chooses whether and where to publish the review.

## Product goals

- Mobile-first and simple customer experience.
- Data-driven service catalog rather than hardcoded service logic.
- AI-assisted writing without fabricating customer experiences.
- Clear separation between private feedback and public review publishing.
- Architecture that can support RM Solution first and additional clients later.
- Secure handling of client, customer, and integration data.
- Small, testable, independently changeable features.

## Initial scope

The first release should focus on the feedback and review-assistance flow. Administrative features, analytics, client management, and deeper Google integrations should be introduced only through explicit feature specifications.

## Explicit non-goals

- Fake reviews or fabricated customer experiences.
- Forcing customers to leave positive reviews.
- Review gating based on rating or sentiment.
- Automatically publishing a review without the customer's intentional action unless an officially supported integration and compliant product flow is later approved.
- Building the entire RM Solution CRM, advertising, WhatsApp, or voice-agent platform inside this project.

## Success criteria

The foundation will be successful when the product decisions are explicit, the architecture is documented, the AI workflow is repeatable, and each implementation feature can be developed and verified independently.