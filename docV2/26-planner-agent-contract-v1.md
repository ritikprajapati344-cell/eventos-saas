# EventOS AI V2 - Planner Agent Contract v1

## 1. Contract Status

Version: v1

Status: Sprint 2 prerequisite

Scope: Planner Agent only

This document defines how the Planner Agent transforms:

```text
Command + Clarification Answers
```

into:

```text
Blueprint JSON Contract v1
```

Non-goals:

- no execution
- no approval execution
- no database writes
- no Supabase writes
- no research execution
- no memory writes
- no record creation
- no UI behavior definition

## 2. Planner Agent Role

The Planner Agent is a senior event planning strategist for Indian live events, comedy shows, corporate events, and concerts.

The Planner Agent behaves like an experienced event director who can convert a natural-language command into a professional, approval-ready event blueprint.

The Planner Agent may:

- understand event intent
- normalize event basics
- make safe planning assumptions
- generate an event blueprint
- propose tasks, timeline items, sponsor strategy, budget, revenue, marketing, and risk structure
- mark uncertain areas clearly

The Planner Agent must not:

- create records
- execute tasks
- approve anything
- claim external research was performed unless research context was provided
- write memory
- write to database

## 3. Planner Agent Inputs

The Planner Agent receives a single input payload.

```json
{
  "blueprintJsonContractVersion": "1.0",
  "currentDate": "2026-06-26",
  "originalCommand": "Create a 1500-seat Sunil Grover comedy show in Ahmedabad with ₹50L revenue target.",
  "clarificationAnswers": {
    "eventName": "Sunil Grover Comedy Show",
    "eventType": "Comedy Show",
    "city": "Ahmedabad",
    "eventDate": "2026-09-20",
    "capacity": 1500,
    "budget": 2000000,
    "revenueTarget": 5000000,
    "targetAudience": "Families, professionals, and comedy fans",
    "sponsorPriority": "High",
    "ticketSalesGoal": "Sell out with premium conversion",
    "profitGoal": "Strong positive profit margin",
    "brandingGoal": "Premium live comedy experience",
    "notes": "Keep it sponsor-friendly."
  },
  "workspaceContext": {
    "workspaceId": "workspace_123",
    "workspaceName": "Bliss Blast Events",
    "currency": "INR",
    "timezone": "Asia/Kolkata",
    "primaryCities": ["Ahmedabad", "Gandhidham"],
    "eventTypes": ["Comedy Show", "Concert", "Corporate Event"]
  },
  "futureMemoryContext": {
    "enabled": false,
    "items": []
  },
  "futureResearchContext": {
    "enabled": false,
    "sources": []
  }
}
```

Required inputs:

- `blueprintJsonContractVersion`
- `currentDate`
- `originalCommand`
- `clarificationAnswers`
- `workspaceContext`

Optional future inputs:

- `futureMemoryContext`
- `futureResearchContext`

## 4. Planner Thinking Order

The Planner Agent must reason in this order:

1. Understand event intent.
2. Normalize event basics.
3. Identify missing assumptions.
4. Build event summary.
5. Build budget section.
6. Build revenue section.
7. Build timeline section.
8. Build sponsor section.
9. Build marketing section.
10. Build risk section.
11. Build task checklist.
12. Produce metadata.
13. Return final JSON only.

The Planner Agent must not expose chain-of-thought or internal reasoning. It should only expose short reasons, assumptions, risks, and recommendations inside the JSON fields defined by the Blueprint JSON Contract v1.

## 5. Output Rules

The Planner Agent output must:

- follow `docV2/25-blueprint-json-contract-v1.md`
- return valid JSON only
- include `jsonVersion: "1.0"`
- include all required Blueprint JSON Contract v1 top-level sections
- include no Markdown
- include no conversational explanation
- include no code fences
- include no extra top-level fields
- include no direct execution instructions
- include no unsupported actions
- keep all executable actions approval-gated

The Planner Agent must not output:

- `createSponsorRecordNow`
- `sendWhatsApp`
- `sendEmail`
- `chargePayment`
- `updateBudget`
- `deleteRecord`
- any instruction that bypasses approval

## 6. Assumption Rules

If data is missing, the Planner Agent may make safe assumptions.

Every assumption must be recorded in:

```json
"metadata": {
  "assumptions": []
}
```

Examples of allowed assumptions:

- venue unknown
- artist fee unknown
- exact event date unknown
- local sponsor list not researched yet
- marketing budget not confirmed
- production vendor costs are estimates
- ticket sell-through is estimated

Rules:

- Assumptions must be realistic for Indian live events.
- Assumptions must never be presented as confirmed facts.
- Assumptions must not claim booking, payment, sponsor commitment, research, or execution.
- If an assumption materially affects budget, revenue, timeline, or risk, also mention it in the relevant section.

Architecture note:

Blueprint JSON Contract v1 currently defines `metadata.warnings` and `metadata.schemaNotes`, but not `metadata.assumptions`. Sprint 2 validation should either add `metadata.assumptions` as a permitted metadata field or map planner assumptions into `metadata.warnings` until the contract is amended.

## 7. Safety Rules

The Planner Agent must never:

- create records
- send messages
- modify finance
- modify event budgets
- claim external research was done when it was not
- invent confirmed sponsors
- invent confirmed venue booking
- invent confirmed artist contracts
- mark tasks as executed
- mark timeline items as completed
- mark tickets as sold
- create approvals as already approved
- output execution as already completed

The Planner Agent may only propose.

Approval and execution happen later.

## 8. Confidence Rules

The Planner Agent must provide confidence scores from 0 to 100.

Required confidence fields:

- `eventSummary.confidence`
- `budget.confidence`
- `revenue.confidence`
- `timeline.confidence`
- `sponsors.confidence`
- `marketing.confidence`
- `risks.confidence`
- `taskChecklist.confidence`
- `metadata.overallConfidence`

Confidence scale:

| Score | Label | Meaning |
|---:|---|---|
| 0-40 | Low | Missing key inputs or high uncertainty |
| 41-70 | Medium | Usable but assumptions are important |
| 71-90 | High | Strong enough for review |
| 91-100 | Very High | Strong context with low uncertainty |

Low confidence triggers:

- event date missing
- city missing
- capacity missing or invalid
- budget missing or invalid
- revenue target missing or invalid
- sponsor priority high but no sponsor context
- venue unknown and capacity is large
- research required but not provided
- memory expected but not provided

Mark a section as `needs_review` when:

- required inputs for that section are missing
- values contradict each other
- confidence is below 50
- the section contains high financial uncertainty
- the section includes recommendations based mostly on assumptions

If the root blueprint is still renderable, use:

```json
"status": "needs_review"
```

If the blueprint cannot be safely rendered, use:

```json
"status": "invalid"
```

## 9. Error Handling

### 9.1 Insufficient Input

If required event basics are missing, return a JSON object with:

- `status: "needs_review"`
- all required top-level sections present
- `metadata.warnings` listing missing fields
- `metadata.assumptions` listing any safe assumptions

Do not fabricate missing critical values.

### 9.2 Contradictory Input

Examples:

- command says Ahmedabad, clarification says Gandhidham
- capacity says 1500, notes say 300 guests
- revenue target is lower than expected expenses but profit goal is high

Behavior:

- prefer clarification answers over command
- record contradiction in `metadata.warnings`
- mark affected sections `needs_review`

### 9.3 Invalid Budget or Revenue

Invalid examples:

- negative budget
- zero revenue target for a commercial event
- non-numeric budget
- budget far below minimum plausible event cost

Behavior:

- do not calculate false precision
- set uncertain financial values to conservative estimates only if safe
- mark `budget` or `revenue` as `needs_review`
- add warning and assumption

### 9.4 Unsupported Event Type

MVP-supported event types:

- Comedy Show
- Concert
- Corporate Event
- Wedding

If unsupported:

- return `status: "needs_review"`
- normalize to closest safe category only if obvious
- otherwise ask for clarification in metadata warning

### 9.5 Missing Required Fields

If missing:

- `eventName`
- `eventType`
- `city`
- `capacity`
- `revenueTarget`

then approval must be blocked by setting:

```json
"approvals": {
  "requiresApproval": true,
  "items": [],
  "executionPreview": {
    "createEvent": false,
    "createTasks": 0,
    "createTimelineItems": 0,
    "createTicketCategories": 0,
    "createSponsors": 0,
    "createFinanceRecords": 0
  }
}
```

## 10. Prompt Skeleton

### 10.1 System Instruction

```text
You are EventOS AI Planner Agent.
You are a senior event planning strategist for Indian live events, comedy shows, corporate events, and concerts.
Your job is to transform a user command and clarification answers into a Blueprint JSON Contract v1 object.
You never execute actions.
You never create records.
You never claim research, venue booking, sponsor commitment, payment, or execution unless explicitly provided in the input.
You return JSON only.
```

### 10.2 Developer Instruction

```text
Follow docV2/25-blueprint-json-contract-v1.md exactly.
Return every required top-level section.
Use realistic Indian event planning assumptions.
Record every assumption in metadata.assumptions.
Use metadata.warnings for uncertainty, contradictions, and blocked approval reasons.
Use approval status proposed only.
MVP execution preview may propose only event, tasks, timeline items, and ticket categories.
Sponsor, finance, vendor, artist, email, WhatsApp, payment, and delete actions must not be executable in MVP.
Return valid JSON only. No Markdown. No comments. No extra top-level fields.
```

### 10.3 User Input Payload

```json
{
  "blueprintJsonContractVersion": "1.0",
  "currentDate": "2026-06-26",
  "originalCommand": "Create a 1500-seat Sunil Grover comedy show in Ahmedabad with ₹50L revenue target.",
  "clarificationAnswers": {},
  "workspaceContext": {},
  "futureMemoryContext": {},
  "futureResearchContext": {}
}
```

### 10.4 Output Instruction

```text
Return one JSON object that conforms to Blueprint JSON Contract v1.
Do not include Markdown fences.
Do not include explanatory text outside JSON.
Do not include any unknown top-level fields.
```

### 10.5 JSON-Only Rule

The first character of the response must be `{`.

The last character of the response must be `}`.

## 11. Example Input

```json
{
  "blueprintJsonContractVersion": "1.0",
  "currentDate": "2026-06-26",
  "originalCommand": "Create a 1500-seat Sunil Grover comedy show in Ahmedabad with ₹50L revenue target.",
  "clarificationAnswers": {
    "eventName": "Sunil Grover Comedy Show",
    "eventType": "Comedy Show",
    "city": "Ahmedabad",
    "eventDate": "2026-09-20",
    "capacity": 1500,
    "budget": 2000000,
    "revenueTarget": 5000000,
    "targetAudience": "Families, professionals, and comedy fans",
    "sponsorPriority": "High",
    "ticketSalesGoal": "Sell out with premium conversion",
    "profitGoal": "Strong positive profit margin",
    "brandingGoal": "Premium live comedy experience",
    "notes": "Keep it sponsor-friendly."
  },
  "workspaceContext": {
    "workspaceId": "workspace_123",
    "workspaceName": "Bliss Blast Events",
    "currency": "INR",
    "timezone": "Asia/Kolkata",
    "primaryCities": ["Ahmedabad", "Gandhidham"],
    "eventTypes": ["Comedy Show", "Concert", "Corporate Event"]
  },
  "futureMemoryContext": {
    "enabled": false,
    "items": []
  },
  "futureResearchContext": {
    "enabled": false,
    "sources": []
  }
}
```

## 12. Example Output

```json
{
  "jsonVersion": "1.0",
  "blueprintId": "bp_temp_sunil_grover_ahmedabad_001",
  "status": "draft",
  "eventSummary": {
    "eventName": "Sunil Grover Comedy Show",
    "eventType": "Comedy Show",
    "city": "Ahmedabad",
    "venueRecommendation": "Premium 1500-seat auditorium with strong parking, backstage readiness, and sponsor visibility",
    "eventDate": "2026-09-20",
    "capacity": 1500,
    "targetAudience": "Families, working professionals, college audiences, and premium comedy fans",
    "executiveSummary": "A premium live comedy event in Ahmedabad designed around strong ticket revenue, sponsor visibility, and structured execution readiness.",
    "confidence": 86
  },
  "budget": {
    "currency": "INR",
    "totalBudget": 2000000,
    "estimatedExpenses": 3150000,
    "expenseBreakdown": [
      {
        "category": "Venue",
        "amount": 600000,
        "reason": "A 1500-seat premium auditorium is required for audience capacity and sponsor visibility."
      },
      {
        "category": "Artist and hospitality",
        "amount": 1200000,
        "reason": "Headline artist planning requires fee, travel, hospitality, and production buffer."
      },
      {
        "category": "Production",
        "amount": 650000,
        "reason": "Stage, sound, lighting, LED, backstage, and show operations are required."
      },
      {
        "category": "Marketing",
        "amount": 450000,
        "reason": "A premium launch needs creative production, local promotion, and conversion campaigns."
      },
      {
        "category": "Operations buffer",
        "amount": 250000,
        "reason": "Security, staffing, permissions, and contingency should be reserved."
      }
    ],
    "budgetRisks": [
      {
        "title": "Budget below estimated expense requirement",
        "severity": "high",
        "reason": "The stated budget is lower than the estimated expense base for a premium headline comedy event.",
        "mitigation": "Increase sponsor target, negotiate production early, or reduce non-critical spending."
      }
    ],
    "confidence": 78
  },
  "revenue": {
    "currency": "INR",
    "targetRevenue": 5000000,
    "projectedRevenue": 5400000,
    "estimatedProfit": 2250000,
    "breakEvenRevenue": 3150000,
    "ticketRevenueForecast": 4050000,
    "sponsorRevenueForecast": 1350000,
    "assumptions": [
      "Overall ticket sell-through reaches 85 percent.",
      "Premium categories carry a larger share of revenue.",
      "Sponsor outreach starts before public ticket launch."
    ],
    "recommendations": [
      "Protect premium pricing during the first sales window.",
      "Use sponsor commitments to reduce break-even pressure.",
      "Track ticket conversion weekly."
    ],
    "confidence": 82
  },
  "timeline": {
    "milestones": [
      {
        "title": "Finalize venue shortlist",
        "phase": "planning",
        "suggestedDate": "2026-07-05",
        "priority": "high",
        "description": "Compare venues for capacity, parking, stage readiness, backstage needs, and sponsor branding.",
        "approvalRequired": true
      },
      {
        "title": "Prepare sponsor deck",
        "phase": "sponsorship",
        "suggestedDate": "2026-07-10",
        "priority": "high",
        "description": "Create sponsor packages, benefits, pricing, audience profile, and outreach list.",
        "approvalRequired": true
      },
      {
        "title": "Launch ticket campaign",
        "phase": "marketing",
        "suggestedDate": "2026-08-01",
        "priority": "critical",
        "description": "Open ticket sales with premium positioning, launch creatives, and conversion tracking.",
        "approvalRequired": true
      }
    ],
    "confidence": 84
  },
  "sponsors": {
    "targetRevenue": 1500000,
    "categories": ["Real Estate", "Jewellery", "Automobile", "Education", "Hospitality"],
    "recommendedSponsors": [
      {
        "name": "Local real estate developer",
        "category": "Real Estate",
        "estimatedValue": 500000,
        "reason": "Good fit for premium family and professional audience reach.",
        "confidence": 68
      },
      {
        "name": "Regional jewellery brand",
        "category": "Jewellery",
        "estimatedValue": 300000,
        "reason": "Relevant to affluent family audiences and premium positioning.",
        "confidence": 66
      }
    ],
    "packages": [
      {
        "name": "Title Sponsor",
        "price": 700000,
        "benefits": ["Naming association", "Main stage logo", "Premium social media mentions"]
      },
      {
        "name": "Powered By Sponsor",
        "price": 400000,
        "benefits": ["Secondary logo placement", "Digital campaign mentions", "Venue branding"]
      }
    ],
    "pitchStrategy": "Position the event as a premium family comedy experience with strong local visibility and sponsor-friendly audience demographics.",
    "outreachPlan": ["Prepare sponsor deck", "Shortlist local brands", "Schedule first sponsor meetings before ticket launch"],
    "confidence": 74
  },
  "marketing": {
    "campaignStrategy": "Build excitement around the artist, then convert using premium seat scarcity and family-friendly positioning.",
    "channels": ["Instagram", "WhatsApp", "Local influencer pages", "Sponsor channels"],
    "contentIdeas": ["Artist announcement poster", "Short teaser reel", "Premium seat countdown", "Sponsor reveal posts"],
    "launchPlan": [
      {
        "title": "Announcement week",
        "phase": "awareness",
        "description": "Publish event announcement creatives and artist-led hooks."
      },
      {
        "title": "Early conversion window",
        "phase": "conversion",
        "description": "Promote premium categories and early seat selection."
      }
    ],
    "estimatedReach": 250000,
    "recommendations": ["Launch ticket sales only after campaign assets are ready", "Use sponsor channels to reduce paid media pressure"],
    "confidence": 72
  },
  "risks": {
    "overallRiskScore": 42,
    "overallRiskLevel": "medium",
    "items": [
      {
        "title": "Sponsor revenue shortfall",
        "category": "sponsors",
        "severity": "medium",
        "reason": "The plan depends on sponsor revenue to comfortably exceed the target.",
        "mitigation": "Start sponsor outreach early and use tiered packages.",
        "approvalImpact": "Review sponsor strategy before sponsor-related task execution."
      },
      {
        "title": "Premium ticket conversion risk",
        "category": "ticketing",
        "severity": "medium",
        "reason": "Revenue target depends on strong premium category sales.",
        "mitigation": "Use early scarcity and premium positioning.",
        "approvalImpact": "Review ticket strategy before ticket category creation."
      }
    ],
    "confidence": 80
  },
  "taskChecklist": {
    "tasks": [
      {
        "title": "Finalize event venue shortlist",
        "description": "Compare venue options for capacity, stage readiness, parking, and sponsor branding.",
        "priority": "high",
        "dueDate": "2026-07-05",
        "ownerRole": "Operations",
        "approvalRequired": true
      },
      {
        "title": "Prepare sponsor proposal deck",
        "description": "Create sponsor packages, audience profile, benefits, and pricing.",
        "priority": "high",
        "dueDate": "2026-07-10",
        "ownerRole": "Sponsorship",
        "approvalRequired": true
      },
      {
        "title": "Draft ticket category plan",
        "description": "Prepare category names, pricing assumptions, and inventory allocation.",
        "priority": "high",
        "dueDate": "2026-07-12",
        "ownerRole": "Ticketing",
        "approvalRequired": true
      }
    ],
    "confidence": 86
  },
  "approvals": {
    "requiresApproval": true,
    "approvalMode": "module",
    "items": [
      {
        "approvalKey": "event.create",
        "module": "event",
        "title": "Approve event creation",
        "description": "Create the Sunil Grover Comedy Show event record after review.",
        "approvalLevel": 1,
        "riskLevel": "low",
        "actionCount": 1,
        "status": "proposed"
      },
      {
        "approvalKey": "tasks.create",
        "module": "tasks",
        "title": "Approve task creation",
        "description": "Create three planning tasks from the approved blueprint.",
        "approvalLevel": 1,
        "riskLevel": "low",
        "actionCount": 3,
        "status": "proposed"
      },
      {
        "approvalKey": "timeline.create",
        "module": "timeline",
        "title": "Approve timeline creation",
        "description": "Create three timeline milestones from the approved blueprint.",
        "approvalLevel": 1,
        "riskLevel": "low",
        "actionCount": 3,
        "status": "proposed"
      }
    ],
    "executionPreview": {
      "createEvent": true,
      "createTasks": 3,
      "createTimelineItems": 3,
      "createTicketCategories": 0,
      "createSponsors": 0,
      "createFinanceRecords": 0
    }
  },
  "metadata": {
    "generatedAt": "2026-06-26T10:00:00+05:30",
    "generatedBy": "planner-agent",
    "model": "gemini",
    "agentsUsed": ["planner"],
    "researchUsed": false,
    "memoryUsed": false,
    "sourceRequestId": "req_sunil_grover_ahmedabad_001",
    "overallConfidence": 81,
    "assumptions": [
      "Venue is not confirmed; a premium 1500-seat auditorium is assumed.",
      "Artist fee is estimated because no confirmed artist commercial terms were provided.",
      "Sponsor names are category-level placeholders because no research context was provided.",
      "Ticket sell-through is estimated and not based on live sales data."
    ],
    "warnings": [
      "No external research was provided.",
      "No memory context was provided.",
      "Sponsor recommendations are not confirmed sponsors.",
      "MVP must not create sponsor or finance records from this blueprint."
    ],
    "schemaNotes": [
      "Planner Agent output follows Blueprint JSON Contract v1.",
      "Approval statuses remain proposed.",
      "Execution preview is approval-gated."
    ]
  }
}
```

## 13. Sprint 2 Implementation Notes

Sprint 2 should use this document as follows:

1. Frontend collects command and clarification answers.
2. Frontend sends command, clarification answers, current date, workspace context placeholder, and contract version to the backend or Edge Function.
3. Backend/function calls Gemini with the Planner Agent prompt.
4. Gemini returns JSON only.
5. System parses JSON.
6. System validates against Blueprint JSON Contract v1.
7. Blueprint Preview renders validated JSON.
8. Validation warnings are shown to the user.
9. No execution runs in Sprint 2.
10. No approvals are executed in Sprint 2.
11. No database writes are required for the first Sprint 2 preview unless separately approved.

Sprint 2 should not:

- create events
- create tasks
- create timeline items
- create ticket categories
- create sponsors
- create finance records
- write memory
- claim research

## 14. Final Rule

Planner creates blueprint only.

Approval and execution happen later.

No Planner Agent output is trusted until it passes validation against Blueprint JSON Contract v1.
