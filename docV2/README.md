# EventOS AI V2 Documentation

> EventOS AI V2 documentation is the source of truth. No feature should be coded unless it is present in this blueprint or added through an approved documentation update.

## What EventOS AI V2 Is

EventOS AI V2 is the blueprint for transforming EventOS from a traditional event management SaaS into an AI Event Operating System.

The core product promise is:

```text
User command
-> AI clarification
-> Event Blueprint
-> Human approval
-> Safe execution
-> History
-> Memory
```

EventOS AI should let an organizer describe an event in natural language, receive a professional event blueprint, approve the plan, and let the system create approved operational records safely.

## Why docV2 Exists

The `docV2/` folder contains the official planning documents for EventOS AI V2. It defines the product direction, MVP scope, agent model, approval model, execution model, memory model, research model, technical architecture, UX direction, and first implementation sprint.

These documents should be treated as the planning baseline before V2 engineering work begins.

## Locked MVP Flow

The locked MVP flow is:

```text
Command
-> Clarification
-> Blueprint
-> Approval
-> Execution
-> History
-> Memory
```

No execution should bypass approval.

## Included MVP Scope

The MVP includes:

- AI Command Center
- Clarification flow
- Event Blueprint generation
- Human approval system
- Execution of approved records
- Execution history
- Memory foundation
- Existing V1 modules used as hidden engines
- MVP agents:
  - Planner Agent
  - Sponsor Agent
  - Finance Agent
  - Risk Agent

The MVP execution scope is limited to:

- Events
- Tasks
- Timeline items
- Ticket categories

## Excluded MVP Scope

The MVP excludes:

- WhatsApp sending
- Email sending
- Voice commands
- Mobile app
- CRM integrations
- Calendar integrations
- Payment execution
- Auto sponsor outreach
- Auto vendor management
- Auto artist management
- Advanced enterprise roles
- Unapproved AI execution

## Reading Order

1. `01-vision-and-prd.md`
2. `02-trd.md`
3. `03-agent-architecture.md`
4. `04-ux-flow.md`
5. `05-system-architecture-blueprint.md`
6. `06-roadmap.md`
7. `07-database-blueprint.md`
8. `08-memory-specification.md`
9. `09-approval-specification.md`
10. `10-research-specification.md`
11. `11-agent-communication-specification.md`
12. `12-planning-gap-note.md`
13. `13-mvp-scope-lock.md`
14. `14-blueprint-schema.md`
15. `15-agent-prompt-specification.md`
16. `16-execution-rules.md`
17. `17-success-metrics-kpi.md`
18. `18-full-blueprint-review.md`
19. `19-gap-analysis-report.md`
20. `20-mvp-final-lock.md`
21. `21-sprint-zero.md`
22. `22-ui-experience-blueprint.md`
23. `23-architecture-freeze.md`
24. `24-sprint-1-ai-command-center-foundation.md`
25. `25-blueprint-json-contract-v1.md`
26. `26-planner-agent-contract-v1.md`

Documents 25 and 26 define the AI-to-UI contract required before Sprint 2 Gemini Planning Engine work.

## Current Status

The V2 planning baseline is organized and ready for review. The documents define a clear direction:

- EventOS AI becomes the primary user experience.
- Existing V1 modules remain available as data and execution engines.
- V2 MVP starts with the AI-first command experience.
- Execution remains approval-first and audit-friendly.

## Next Step

Start Sprint 1:

```text
AI Command Center Foundation
```

Sprint 1 should focus on the AI-first shell and command-center user experience only. It should not introduce agents, memory, research, execution, or AI model behavior unless those changes are explicitly added through an approved documentation update.
