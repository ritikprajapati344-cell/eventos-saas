# EventOS AI V2 - Blueprint JSON Contract v1

## Contract Status

This document is the official Blueprint JSON Contract for EventOS AI V2.

All AI model outputs, agent outputs, research-enriched outputs, memory-enriched outputs, approval previews, and execution previews must conform to this contract or be transformed into this contract before rendering or execution.

This contract applies to:

- Gemini
- Planner Agent
- Sponsor Agent
- Finance Agent
- Risk Agent
- Future Research Agent
- Future Memory Engine
- Approval Engine
- Execution Engine

## 1. Purpose

The Event Blueprint is the heart of EventOS AI.

Free-text AI output is not safe enough for EventOS because it is:

- hard to validate
- hard to render consistently
- hard to approve module-by-module
- hard to execute safely
- hard to audit
- easy for models to hallucinate
- difficult for memory and research systems to reuse

EventOS AI requires structured JSON because every blueprint must be:

- human readable
- machine renderable
- approval safe
- execution safe
- memory friendly
- agent compatible
- versioned
- auditable

The AI may write recommendations, explanations, and plans, but EventOS must never execute raw generated text. EventOS executes only validated, approved, typed, contract-compliant objects.

## 2. Input Contract

The Input Contract defines everything sent to Gemini or any future model that generates a blueprint.

### 2.1 Input Shape

```json
{
  "contractVersion": "1.0",
  "requestId": "req_2026_001",
  "currentDate": "2026-06-26",
  "originalCommand": "Create a 1500-seat Sunil Grover comedy show in Ahmedabad with INR 50L revenue target.",
  "clarificationAnswers": {
    "eventName": "Sunil Grover Comedy Show",
    "eventType": "Comedy Show",
    "city": "Ahmedabad",
    "eventDate": "2026-09-20",
    "capacity": 1500,
    "budget": 2000000,
    "revenueTarget": 5000000,
    "targetAudience": "Families, professionals, comedy fans",
    "sponsorPriority": "High",
    "ticketSalesGoal": "Sell out with strong premium category conversion",
    "profitGoal": "INR 15L profit target",
    "brandingGoal": "Premium live comedy experience",
    "notes": "Prefer a polished sponsor-friendly event plan."
  },
  "workspaceContext": {
    "workspaceId": "workspace_123",
    "workspaceName": "Bliss Blast Events",
    "primaryCities": ["Ahmedabad", "Gandhidham"],
    "eventTypes": ["Comedy Show", "Concert", "Corporate Event"],
    "currency": "INR",
    "timezone": "Asia/Kolkata",
    "existingEventsSummary": {
      "totalEvents": 12,
      "activeEvents": 3,
      "completedEvents": 9
    },
    "availableHistoricalSignals": {
      "tickets": true,
      "sponsors": true,
      "finance": true,
      "vendors": false,
      "marketing": false
    }
  },
  "userPreferences": {
    "tone": "Professional, confident, executive-level",
    "detailLevel": "High",
    "riskTolerance": "Medium",
    "approvalStyle": "Module-by-module",
    "preferredOutputLanguage": "English"
  },
  "futureMemory": {
    "enabled": false,
    "memoryReferences": [],
    "placeholder": "Future memory engine will inject past events, sponsors, ticket performance, finance outcomes, and user preferences here."
  }
}
```

### 2.2 Input Field Definitions

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `contractVersion` | string | Yes | Input contract version. | `"1.0"` |
| `requestId` | string | Yes | Unique request identifier for tracing. | `"req_2026_001"` |
| `currentDate` | string | Yes | ISO date when blueprint is requested. | `"2026-06-26"` |
| `originalCommand` | string | Yes | Raw user command. Must not be lost. | `"Create Sunil Grover show..."` |
| `clarificationAnswers` | object | Yes | User-confirmed answers collected before blueprint generation. | See below |
| `workspaceContext` | object | Yes | Workspace-level context available to the AI. | See below |
| `userPreferences` | object | Yes | User and workspace preferences for style and planning. | See below |
| `futureMemory` | object | Yes | Placeholder for future memory retrieval output. | See below |

### 2.3 Clarification Answer Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `eventName` | string | Yes | Proposed event name. | `"Sunil Grover Comedy Show"` |
| `eventType` | string | Yes | Event type. | `"Comedy Show"` |
| `city` | string | Yes | Event city. | `"Ahmedabad"` |
| `eventDate` | string | Yes | ISO event date. | `"2026-09-20"` |
| `capacity` | number | Yes | Expected audience capacity. | `1500` |
| `budget` | number | Yes | Planned event budget in smallest full currency unit, not paise. | `2000000` |
| `revenueTarget` | number | Yes | Target gross revenue. | `5000000` |
| `targetAudience` | string | Yes | Audience profile. | `"Families and comedy fans"` |
| `sponsorPriority` | string | Yes | Sponsor importance. | `"High"` |
| `ticketSalesGoal` | string | Yes | Ticketing objective. | `"Sell out"` |
| `profitGoal` | string | Yes | Profit objective. | `"INR 15L profit"` |
| `brandingGoal` | string | Yes | Brand positioning objective. | `"Premium live comedy"` |
| `notes` | string | No | Extra user notes. | `"Sponsor-friendly"` |

### 2.4 Workspace Context Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `workspaceId` | string | Yes | Current workspace ID. | `"workspace_123"` |
| `workspaceName` | string | Yes | Workspace/company name. | `"Bliss Blast Events"` |
| `primaryCities` | string[] | No | Cities where the organizer operates. | `["Ahmedabad"]` |
| `eventTypes` | string[] | No | Event types commonly handled by the workspace. | `["Comedy Show"]` |
| `currency` | string | Yes | Currency code. | `"INR"` |
| `timezone` | string | Yes | Workspace timezone. | `"Asia/Kolkata"` |
| `existingEventsSummary` | object | No | Aggregate event counts. | `{ "activeEvents": 3 }` |
| `availableHistoricalSignals` | object | No | Which data categories have history available. | `{ "tickets": true }` |

### 2.5 User Preference Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `tone` | string | No | Preferred writing tone. | `"Executive"` |
| `detailLevel` | string | No | Expected depth of blueprint. | `"High"` |
| `riskTolerance` | string | No | User preference for conservative vs aggressive plans. | `"Medium"` |
| `approvalStyle` | string | No | Preferred approval granularity. | `"Module-by-module"` |
| `preferredOutputLanguage` | string | No | Output language. | `"English"` |

### 2.6 Future Memory Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `enabled` | boolean | Yes | Whether memory context is active. | `false` |
| `memoryReferences` | object[] | Yes | Future list of retrieved memory items. | `[]` |
| `placeholder` | string | No | Human-readable placeholder note. | `"Future memory..."` |

## 3. Output Contract

The Output Contract defines the JSON object returned by Gemini or any future blueprint-generating model.

The model must return JSON only. No Markdown fences. No commentary before or after JSON.

### 3.1 Root Output Shape

```json
{
  "jsonVersion": "1.0",
  "blueprintId": "bp_temp_001",
  "status": "draft",
  "eventSummary": {},
  "budget": {},
  "revenue": {},
  "timeline": {},
  "sponsors": {},
  "marketing": {},
  "risks": {},
  "taskChecklist": {},
  "approvals": {},
  "metadata": {}
}
```

### 3.2 Complete Output Schema

```json
{
  "jsonVersion": "1.0",
  "blueprintId": "string",
  "status": "draft",
  "eventSummary": {
    "eventName": "string",
    "eventType": "string",
    "city": "string",
    "venueRecommendation": "string",
    "eventDate": "YYYY-MM-DD",
    "capacity": 0,
    "targetAudience": "string",
    "executiveSummary": "string",
    "confidence": 0
  },
  "budget": {
    "currency": "INR",
    "totalBudget": 0,
    "estimatedExpenses": 0,
    "expenseBreakdown": [
      {
        "category": "string",
        "amount": 0,
        "reason": "string"
      }
    ],
    "budgetRisks": [
      {
        "title": "string",
        "severity": "low",
        "reason": "string",
        "mitigation": "string"
      }
    ],
    "confidence": 0
  },
  "revenue": {
    "currency": "INR",
    "targetRevenue": 0,
    "projectedRevenue": 0,
    "estimatedProfit": 0,
    "breakEvenRevenue": 0,
    "ticketRevenueForecast": 0,
    "sponsorRevenueForecast": 0,
    "assumptions": ["string"],
    "recommendations": ["string"],
    "confidence": 0
  },
  "timeline": {
    "milestones": [
      {
        "title": "string",
        "phase": "planning",
        "suggestedDate": "YYYY-MM-DD",
        "priority": "high",
        "description": "string",
        "approvalRequired": true
      }
    ],
    "confidence": 0
  },
  "sponsors": {
    "targetRevenue": 0,
    "categories": ["string"],
    "recommendedSponsors": [
      {
        "name": "string",
        "category": "string",
        "estimatedValue": 0,
        "reason": "string",
        "confidence": 0
      }
    ],
    "packages": [
      {
        "name": "string",
        "price": 0,
        "benefits": ["string"]
      }
    ],
    "pitchStrategy": "string",
    "outreachPlan": ["string"],
    "confidence": 0
  },
  "marketing": {
    "campaignStrategy": "string",
    "channels": ["string"],
    "contentIdeas": ["string"],
    "launchPlan": [
      {
        "title": "string",
        "phase": "string",
        "description": "string"
      }
    ],
    "estimatedReach": 0,
    "recommendations": ["string"],
    "confidence": 0
  },
  "risks": {
    "overallRiskScore": 0,
    "overallRiskLevel": "medium",
    "items": [
      {
        "title": "string",
        "category": "ticketing",
        "severity": "medium",
        "reason": "string",
        "mitigation": "string",
        "approvalImpact": "string"
      }
    ],
    "confidence": 0
  },
  "taskChecklist": {
    "tasks": [
      {
        "title": "string",
        "description": "string",
        "priority": "high",
        "dueDate": "YYYY-MM-DD",
        "ownerRole": "Operations",
        "approvalRequired": true
      }
    ],
    "confidence": 0
  },
  "approvals": {
    "requiresApproval": true,
    "approvalMode": "module",
    "items": [
      {
        "approvalKey": "string",
        "module": "tasks",
        "title": "string",
        "description": "string",
        "approvalLevel": 1,
        "riskLevel": "low",
        "actionCount": 0,
        "status": "proposed"
      }
    ],
    "executionPreview": {
      "createEvent": true,
      "createTasks": 0,
      "createTimelineItems": 0,
      "createTicketCategories": 0,
      "createSponsors": 0,
      "createFinanceRecords": 0
    }
  },
  "metadata": {
    "generatedAt": "ISO-8601 datetime",
    "generatedBy": "gemini",
    "model": "string",
    "agentsUsed": ["planner", "sponsor", "finance", "risk"],
    "researchUsed": false,
    "memoryUsed": false,
    "sourceRequestId": "string",
    "assumptions": ["string"],
    "warnings": ["string"],
    "schemaNotes": ["string"]
  }
}
```

## 4. Field Definitions

### 4.1 Root Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `jsonVersion` | string | Yes | Blueprint contract version. | `"1.0"` |
| `blueprintId` | string | Yes | Temporary or persisted blueprint ID. | `"bp_temp_001"` |
| `status` | string | Yes | Blueprint status. Allowed: `draft`, `needs_review`, `invalid`. | `"draft"` |
| `eventSummary` | object | Yes | Main event summary. | `{}` |
| `budget` | object | Yes | Budget plan. | `{}` |
| `revenue` | object | Yes | Revenue and profitability plan. | `{}` |
| `timeline` | object | Yes | Timeline milestones. | `{}` |
| `sponsors` | object | Yes | Sponsor strategy. | `{}` |
| `marketing` | object | Yes | Marketing strategy. | `{}` |
| `risks` | object | Yes | Risk report. | `{}` |
| `taskChecklist` | object | Yes | Task plan. | `{}` |
| `approvals` | object | Yes | Approval and execution preview. | `{}` |
| `metadata` | object | Yes | Generation metadata and audit support. | `{}` |

### 4.2 Event Summary Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `eventName` | string | Yes | User-facing event name. | `"Sunil Grover Comedy Show"` |
| `eventType` | string | Yes | Event type. | `"Comedy Show"` |
| `city` | string | Yes | Event city. | `"Ahmedabad"` |
| `venueRecommendation` | string | No | Suggested venue or venue type. | `"Premium auditorium"` |
| `eventDate` | string | Yes | ISO event date. | `"2026-09-20"` |
| `capacity` | number | Yes | Planned capacity. | `1500` |
| `targetAudience` | string | Yes | Audience profile. | `"Families and comedy fans"` |
| `executiveSummary` | string | Yes | Concise executive summary. | `"A premium comedy event..."` |
| `confidence` | number | Yes | Confidence 0-100. | `84` |

### 4.3 Budget Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `currency` | string | Yes | Currency code. | `"INR"` |
| `totalBudget` | number | Yes | User budget or AI-estimated working budget. | `2000000` |
| `estimatedExpenses` | number | Yes | Total estimated expenses. | `3150000` |
| `expenseBreakdown` | object[] | Yes | Expense categories and amounts. | See below |
| `expenseBreakdown[].category` | string | Yes | Expense category name. | `"Venue"` |
| `expenseBreakdown[].amount` | number | Yes | Estimated amount. | `600000` |
| `expenseBreakdown[].reason` | string | Yes | Why the amount is included. | `"1500-seat venue requirement"` |
| `budgetRisks` | object[] | Yes | Budget risk list. | See below |
| `budgetRisks[].title` | string | Yes | Risk title. | `"Production cost overrun"` |
| `budgetRisks[].severity` | string | Yes | `low`, `medium`, `high`, `critical`. | `"medium"` |
| `budgetRisks[].reason` | string | Yes | Why this is a risk. | `"Premium production..."` |
| `budgetRisks[].mitigation` | string | Yes | Suggested mitigation. | `"Lock vendors early"` |
| `confidence` | number | Yes | Confidence 0-100. | `78` |

### 4.4 Revenue Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `currency` | string | Yes | Currency code. | `"INR"` |
| `targetRevenue` | number | Yes | User target revenue. | `5000000` |
| `projectedRevenue` | number | Yes | AI-projected gross revenue. | `5400000` |
| `estimatedProfit` | number | Yes | Projected revenue minus projected expenses. | `2250000` |
| `breakEvenRevenue` | number | Yes | Revenue needed to cover expenses. | `3150000` |
| `ticketRevenueForecast` | number | Yes | Ticket revenue forecast. | `4050000` |
| `sponsorRevenueForecast` | number | Yes | Sponsor revenue forecast. | `1350000` |
| `assumptions` | string[] | Yes | Planning assumptions. | `["70% sell-through"]` |
| `recommendations` | string[] | Yes | Revenue recommendations. | `["Protect premium tiers"]` |
| `confidence` | number | Yes | Confidence 0-100. | `82` |

### 4.5 Timeline Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `milestones` | object[] | Yes | Timeline milestone list. | See below |
| `milestones[].title` | string | Yes | Timeline item title. | `"Launch ticket campaign"` |
| `milestones[].phase` | string | Yes | Planning phase. | `"marketing"` |
| `milestones[].suggestedDate` | string | No | ISO suggested date. | `"2026-08-10"` |
| `milestones[].priority` | string | Yes | `low`, `medium`, `high`, `critical`. | `"high"` |
| `milestones[].description` | string | Yes | What should happen. | `"Begin public ticket sales"` |
| `milestones[].approvalRequired` | boolean | Yes | Whether item requires approval before creation. | `true` |
| `confidence` | number | Yes | Confidence 0-100. | `85` |

### 4.6 Sponsors Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `targetRevenue` | number | Yes | Sponsorship target. | `1500000` |
| `categories` | string[] | Yes | Sponsor categories. | `["Real Estate"]` |
| `recommendedSponsors` | object[] | Yes | Sponsor suggestions. | See below |
| `recommendedSponsors[].name` | string | No | Sponsor name, if known. | `"Local real estate brand"` |
| `recommendedSponsors[].category` | string | Yes | Sponsor category. | `"Real Estate"` |
| `recommendedSponsors[].estimatedValue` | number | Yes | Estimated sponsor value. | `300000` |
| `recommendedSponsors[].reason` | string | Yes | Why sponsor fits. | `"Audience alignment"` |
| `recommendedSponsors[].confidence` | number | Yes | Confidence 0-100. | `72` |
| `packages` | object[] | Yes | Sponsorship packages. | See below |
| `packages[].name` | string | Yes | Package name. | `"Title Sponsor"` |
| `packages[].price` | number | Yes | Package price. | `700000` |
| `packages[].benefits` | string[] | Yes | Sponsor benefits. | `["Logo on stage"]` |
| `pitchStrategy` | string | Yes | Sponsor pitch direction. | `"Position as premium family reach"` |
| `outreachPlan` | string[] | Yes | Outreach steps. | `["Prepare deck"]` |
| `confidence` | number | Yes | Confidence 0-100. | `76` |

### 4.7 Marketing Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `campaignStrategy` | string | Yes | Overall marketing strategy. | `"Premium comedy launch"` |
| `channels` | string[] | Yes | Recommended channels. | `["Instagram", "WhatsApp"]` |
| `contentIdeas` | string[] | Yes | Content ideas. | `["Artist announcement reel"]` |
| `launchPlan` | object[] | Yes | Campaign plan. | See below |
| `launchPlan[].title` | string | Yes | Plan item title. | `"Announcement week"` |
| `launchPlan[].phase` | string | Yes | Campaign phase. | `"awareness"` |
| `launchPlan[].description` | string | Yes | Plan details. | `"Launch event poster..."` |
| `estimatedReach` | number | No | Estimated audience reach. | `250000` |
| `recommendations` | string[] | Yes | Marketing recommendations. | `["Use short video clips"]` |
| `confidence` | number | Yes | Confidence 0-100. | `70` |

### 4.8 Risks Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `overallRiskScore` | number | Yes | Risk score 0-100 where higher means riskier. | `42` |
| `overallRiskLevel` | string | Yes | `low`, `medium`, `high`, `critical`. | `"medium"` |
| `items` | object[] | Yes | Risk list. | See below |
| `items[].title` | string | Yes | Risk title. | `"Sponsor shortfall"` |
| `items[].category` | string | Yes | Risk category. | `"sponsors"` |
| `items[].severity` | string | Yes | `low`, `medium`, `high`, `critical`. | `"medium"` |
| `items[].reason` | string | Yes | Why risk exists. | `"High sponsor dependency"` |
| `items[].mitigation` | string | Yes | How to reduce risk. | `"Start outreach early"` |
| `items[].approvalImpact` | string | No | Whether this affects approval. | `"Review sponsor plan before execution"` |
| `confidence` | number | Yes | Confidence 0-100. | `80` |

### 4.9 Task Checklist Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `tasks` | object[] | Yes | Task list. | See below |
| `tasks[].title` | string | Yes | Task title. | `"Finalize venue shortlist"` |
| `tasks[].description` | string | Yes | Task details. | `"Compare 1500-seat venues"` |
| `tasks[].priority` | string | Yes | `low`, `medium`, `high`, `critical`. | `"high"` |
| `tasks[].dueDate` | string | No | ISO due date. | `"2026-07-10"` |
| `tasks[].ownerRole` | string | No | Suggested owner role. | `"Operations"` |
| `tasks[].approvalRequired` | boolean | Yes | Whether task creation requires approval. | `true` |
| `confidence` | number | Yes | Confidence 0-100. | `86` |

### 4.10 Approvals Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `requiresApproval` | boolean | Yes | Must be true for executable blueprint actions. | `true` |
| `approvalMode` | string | Yes | `full`, `module`, or `action`. | `"module"` |
| `items` | object[] | Yes | Approval items. | See below |
| `items[].approvalKey` | string | Yes | Stable approval key. | `"tasks.create"` |
| `items[].module` | string | Yes | Module being approved. | `"tasks"` |
| `items[].title` | string | Yes | User-facing approval title. | `"Approve task creation"` |
| `items[].description` | string | Yes | What approval allows. | `"Create 12 planning tasks"` |
| `items[].approvalLevel` | number | Yes | Approval level 0-4. | `1` |
| `items[].riskLevel` | string | Yes | `low`, `medium`, `high`, `critical`. | `"low"` |
| `items[].actionCount` | number | Yes | Number of actions covered. | `12` |
| `items[].status` | string | Yes | Initial status. Must start as `proposed`. | `"proposed"` |
| `executionPreview` | object | Yes | What execution would create after approval. | See below |
| `executionPreview.createEvent` | boolean | Yes | Whether event creation is proposed. | `true` |
| `executionPreview.createTasks` | number | Yes | Proposed task count. | `12` |
| `executionPreview.createTimelineItems` | number | Yes | Proposed timeline item count. | `8` |
| `executionPreview.createTicketCategories` | number | Yes | Proposed ticket category count. | `4` |
| `executionPreview.createSponsors` | number | Yes | Proposed sponsor record count. MVP should be `0`. | `0` |
| `executionPreview.createFinanceRecords` | number | Yes | Proposed finance record count. MVP should be `0`. | `0` |

### 4.11 Metadata Fields

| Field | Type | Required | Description | Example |
|---|---:|---:|---|---|
| `generatedAt` | string | Yes | ISO datetime. | `"2026-06-26T10:00:00+05:30"` |
| `generatedBy` | string | Yes | Provider or system. | `"gemini"` |
| `model` | string | No | Model identifier. | `"gemini-2.0-flash"` |
| `agentsUsed` | string[] | Yes | Agents represented in output. | `["planner"]` |
| `researchUsed` | boolean | Yes | Whether research influenced output. | `false` |
| `memoryUsed` | boolean | Yes | Whether memory influenced output. | `false` |
| `sourceRequestId` | string | Yes | Links output to input request. | `"req_2026_001"` |
| `assumptions` | string[] | Yes | Safe assumptions AI used while creating the blueprint. | `["Venue is not confirmed; planning uses city-level venue assumptions."]` |
| `warnings` | string[] | Yes | Risks, low-confidence issues, or validation concerns. | `["Revenue estimate confidence is medium because ticket sales history is unavailable."]` |
| `schemaNotes` | string[] | No | Technical notes about schema, contract versioning, or implementation boundaries. | `["MVP excludes sponsor creation"]` |

## 5. Validation Rules

### 5.1 Required Sections

Every valid blueprint must include:

- `jsonVersion`
- `blueprintId`
- `status`
- `eventSummary`
- `budget`
- `revenue`
- `timeline`
- `sponsors`
- `marketing`
- `risks`
- `taskChecklist`
- `approvals`
- `metadata`

If any required section is missing, EventOS AI must mark the blueprint as `needs_review` and show a recovery message instead of silently rendering incomplete content.

### 5.2 Required Field Rules

The following fields are minimum render requirements:

- `eventSummary.eventName`
- `eventSummary.eventType`
- `eventSummary.city`
- `eventSummary.capacity`
- `revenue.targetRevenue`
- `approvals.requiresApproval`
- `metadata.generatedAt`
- `metadata.sourceRequestId`

If these fields are missing, the blueprint must not proceed to approval.

### 5.3 Numeric Rules

Numeric fields must be finite numbers.

Invalid examples:

- `null`
- `NaN`
- `"50 lakh"` when a number is required
- negative capacity
- negative ticket inventory
- negative approval action count

Recovery:

- If safe conversion is possible, normalize.
- If not, set section status to `needs_review`.
- Never execute numeric values that failed validation.

### 5.4 Enum Rules

The following enums must be normalized to lowercase:

- risk levels: `low`, `medium`, `high`, `critical`
- priorities: `low`, `medium`, `high`, `critical`
- approval status: `proposed`, `approved`, `rejected`, `executed`, `failed`, `undone`, `expired`
- approval mode: `full`, `module`, `action`

Unknown enum values must be converted to `needs_review` for that item.

### 5.5 Date Rules

Dates should be ISO strings:

- date: `YYYY-MM-DD`
- datetime: ISO-8601 datetime

If model returns natural language dates such as `"next Friday"`, EventOS AI must not execute that date. It may display it as text in preview, but approval/execution must require normalized dates.

### 5.6 Missing Fields

If a non-critical optional field is missing:

- render a fallback label such as `"Not specified"`
- add a metadata warning
- keep the blueprint in `draft` if core validation passes

If a critical field is missing:

- mark blueprint `needs_review`
- block approval
- ask for clarification or trigger safe regeneration

### 5.7 Hallucinated Fields

If Gemini or an agent returns fields not present in this contract:

- ignore unknown fields for rendering and execution
- optionally store them under internal diagnostics only
- add metadata warning: `"Unknown fields ignored"`
- never execute unknown fields

### 5.8 Fallback Behaviour

If validation fails, EventOS AI should recover in this order:

1. Parse and normalize safe values.
2. Fill optional display fallbacks.
3. Mark specific sections `needs_review`.
4. Ask targeted clarification questions.
5. Regenerate only the failed section if future architecture supports it.
6. Block approval/execution until required fields are valid.

## 6. Error Handling

### 6.1 Invalid JSON

If Gemini returns invalid JSON:

- attempt safe extraction of the first valid JSON object
- strip Markdown fences if present
- retry parse once after cleanup
- if still invalid, return a user-safe error state
- do not render raw invalid response as trusted blueprint
- do not create approval items

### 6.2 Partial JSON

If Gemini returns partial JSON:

- validate whatever sections exist
- mark missing required sections as `needs_review`
- display available safe preview sections only
- block approval/execution
- provide a recovery path: ask clarification or regenerate

### 6.3 Empty Response

If Gemini returns empty response:

- show: `"Blueprint generation returned no usable content."`
- preserve original command and clarification answers
- allow user to retry
- do not create history, approval, execution, or memory records as if a blueprint exists

### 6.4 Hallucinated Fields

If hallucinated fields are present:

- ignore them
- add a validation warning
- never map unknown fields to execution
- never show hallucinated financial commitments as confirmed facts

### 6.5 Missing Sections

If sections are missing:

- missing `eventSummary`, `approvals`, or `metadata`: blueprint invalid
- missing `budget`, `revenue`, `timeline`, `sponsors`, `marketing`, `risks`, or `taskChecklist`: blueprint can render partial preview but cannot proceed to full approval
- EventOS should show exactly which sections need regeneration or review

## 7. Versioning

### 7.1 JSON Version

Every blueprint output must include:

```json
{
  "jsonVersion": "1.0"
}
```

### 7.2 Backward Compatibility

EventOS AI must support reading older valid blueprints for display and history.

Rules:

- minor additions must be optional
- removing fields requires a major version
- execution engine must know which version it is executing
- approval engine must store the version approved by the user

### 7.3 Future Expansion

Future versions may add:

- vendor plan
- artist plan
- research sources
- memory references
- confidence by module
- exports
- deck generation
- external communication drafts

Future fields must not break v1 renderers. Unknown fields must be ignored unless the active contract version explicitly supports them.

## 8. Security

### 8.1 Never Execute AI Output Directly

AI output is not execution.

The flow must remain:

```text
AI Output
-> Contract Validation
-> Blueprint Preview
-> Approval Engine
-> Execution Preview
-> Execution Engine
-> Audit Log
```

### 8.2 Never Trust Generated Text

Generated descriptions, recommendations, sponsor names, dates, budget values, and execution counts are untrusted until validated.

### 8.3 Validation Before Rendering

Before rendering:

- parse JSON
- validate contract version
- validate required sections
- normalize values
- remove unknown fields from trusted render path
- attach warnings

### 8.4 Validation Before Approval

Before approval:

- ensure required fields exist
- ensure executable counts match executable arrays
- ensure approval levels match action sensitivity
- ensure MVP scope is respected

### 8.5 Validation Before Execution

Before execution:

- require authenticated user
- require workspace membership
- require approval
- require validated blueprint
- require execution preview
- require audit log write

### 8.6 MVP Safety Boundaries

MVP execution may create only:

- event
- tasks
- timeline items
- ticket categories

MVP must not automatically:

- create sponsors
- create finance records
- create vendors
- create artists
- send email
- send WhatsApp
- modify payments
- delete records

## 9. Future Mapping

### 9.1 Contract Flow

```text
Blueprint JSON
-> Blueprint Preview
-> Approval Engine
-> Execution Preview
-> Execution Engine
-> History
-> Memory
```

### 9.2 UI Mapping

| JSON Section | Blueprint Preview UI | Approval Engine | Execution Engine |
|---|---|---|---|
| `eventSummary` | Event Summary card | Approve event creation | Create event after approval |
| `budget` | Budget card | Review only in MVP | No finance writes in MVP |
| `revenue` | Revenue card | Review only in MVP | No finance writes in MVP |
| `timeline` | Timeline card | Approve timeline module | Create timeline items after approval |
| `sponsors` | Sponsors card | Draft/review only in MVP | No sponsor creation in MVP |
| `marketing` | Marketing card | Draft/review only in MVP | No external sending in MVP |
| `risks` | Risks card | Review risk before approval | No direct execution |
| `taskChecklist` | Task Checklist card | Approve tasks module | Create tasks after approval |
| `approvals` | Approval Center | Source of proposed approval items | Execution gate |
| `metadata` | Diagnostics/history | Audit support | Execution traceability |

### 9.3 Engine Mapping

| Engine | Reads | Writes |
|---|---|---|
| Blueprint Preview | Validated blueprint JSON | UI only |
| Approval Engine | `approvals.items`, selected modules | Approval records |
| Execution Engine | Approved `executionPreview` and section arrays | Events, tasks, timeline, tickets only in MVP |
| History Engine | Blueprint, approval, execution result | History records |
| Memory Engine | Approved blueprint and execution outcomes | Future memory records |

## 10. Complete Example

```json
{
  "jsonVersion": "1.0",
  "blueprintId": "bp_temp_sunil_grover_ahmedabad_001",
  "status": "draft",
  "eventSummary": {
    "eventName": "Sunil Grover Comedy Show",
    "eventType": "Comedy Show",
    "city": "Ahmedabad",
    "venueRecommendation": "Premium 1500-seat auditorium with strong parking and sponsor visibility",
    "eventDate": "2026-09-20",
    "capacity": 1500,
    "targetAudience": "Families, working professionals, college audiences, and premium comedy fans",
    "executiveSummary": "A premium live comedy event positioned for strong ticket revenue and sponsor visibility in Ahmedabad. The plan focuses on premium ticket tiers, early sponsor outreach, controlled production costs, and a structured execution timeline.",
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
        "reason": "Premium auditorium suitable for 1500 attendees"
      },
      {
        "category": "Artist and hospitality",
        "amount": 1200000,
        "reason": "Headline artist planning, hospitality, and travel buffer"
      },
      {
        "category": "Production",
        "amount": 650000,
        "reason": "Stage, sound, lights, LED, and technical operations"
      },
      {
        "category": "Marketing",
        "amount": 450000,
        "reason": "Digital launch, creative assets, local promotion, and conversion campaigns"
      },
      {
        "category": "Operations buffer",
        "amount": 250000,
        "reason": "Security, staffing, permits, contingency, and show-day operations"
      }
    ],
    "budgetRisks": [
      {
        "title": "Budget below estimated expense requirement",
        "severity": "high",
        "reason": "The stated budget is lower than the projected expense base for a premium 1500-seat artist-led event.",
        "mitigation": "Increase sponsorship target, negotiate venue and production costs early, or reduce non-critical production spend."
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
      "Overall ticket sell-through reaches 85 percent",
      "Premium ticket categories contribute a larger share of ticket revenue",
      "Sponsor outreach begins before public ticket launch",
      "Production costs are locked before campaign scale-up"
    ],
    "recommendations": [
      "Protect premium pricing for the first sales window",
      "Use sponsor commitments to reduce break-even pressure",
      "Track ticket conversion weekly after launch"
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
        "description": "Shortlist and compare venues that can support 1500 attendees, sponsor branding, backstage needs, and parking.",
        "approvalRequired": true
      },
      {
        "title": "Prepare sponsor deck",
        "phase": "sponsorship",
        "suggestedDate": "2026-07-10",
        "priority": "high",
        "description": "Create a sponsor proposal with audience profile, branding inventory, package prices, and expected reach.",
        "approvalRequired": true
      },
      {
        "title": "Launch ticket campaign",
        "phase": "marketing",
        "suggestedDate": "2026-08-01",
        "priority": "critical",
        "description": "Open ticket sales with premium category positioning and announcement creatives.",
        "approvalRequired": true
      }
    ],
    "confidence": 84
  },
  "sponsors": {
    "targetRevenue": 1500000,
    "categories": [
      "Real Estate",
      "Jewellery",
      "Automobile",
      "Education",
      "Hospitality"
    ],
    "recommendedSponsors": [
      {
        "name": "Premium local real estate developer",
        "category": "Real Estate",
        "estimatedValue": 500000,
        "reason": "Strong fit for affluent family and professional audience reach.",
        "confidence": 72
      },
      {
        "name": "Regional jewellery brand",
        "category": "Jewellery",
        "estimatedValue": 300000,
        "reason": "Good brand alignment with premium family entertainment.",
        "confidence": 70
      },
      {
        "name": "Automobile dealer group",
        "category": "Automobile",
        "estimatedValue": 250000,
        "reason": "Useful for onsite display and premium audience targeting.",
        "confidence": 68
      }
    ],
    "packages": [
      {
        "name": "Title Sponsor",
        "price": 700000,
        "benefits": [
          "Naming association",
          "Main stage logo",
          "Premium social media mentions",
          "Onsite brand visibility"
        ]
      },
      {
        "name": "Powered By Sponsor",
        "price": 400000,
        "benefits": [
          "Secondary logo placement",
          "Digital campaign mentions",
          "Venue branding"
        ]
      },
      {
        "name": "Associate Sponsor",
        "price": 200000,
        "benefits": [
          "Logo on event creatives",
          "Onsite standee placement",
          "Thank-you mention"
        ]
      }
    ],
    "pitchStrategy": "Position the event as a premium family comedy experience with strong local visibility, high social share potential, and sponsor-friendly audience demographics.",
    "outreachPlan": [
      "Prepare sponsor deck",
      "Shortlist 20 local brands",
      "Prioritize five premium sponsor categories",
      "Schedule first sponsor meetings before ticket launch"
    ],
    "confidence": 75
  },
  "marketing": {
    "campaignStrategy": "Create an early excitement wave around the artist, then convert with premium ticket scarcity and family-friendly positioning.",
    "channels": [
      "Instagram",
      "WhatsApp",
      "Local influencer pages",
      "Partner communities",
      "Sponsor channels"
    ],
    "contentIdeas": [
      "Artist announcement poster",
      "Short comedy-style teaser reel",
      "Premium seat countdown",
      "Family night positioning creative",
      "Sponsor reveal posts"
    ],
    "launchPlan": [
      {
        "title": "Announcement week",
        "phase": "awareness",
        "description": "Publish event announcement creatives and artist-led hooks."
      },
      {
        "title": "Early ticket conversion",
        "phase": "conversion",
        "description": "Promote premium categories and early seat selection."
      },
      {
        "title": "Final urgency push",
        "phase": "closing",
        "description": "Use scarcity, testimonials, and sponsor amplification."
      }
    ],
    "estimatedReach": 250000,
    "recommendations": [
      "Launch ticket sales only after campaign assets are ready",
      "Use sponsor channels to reduce paid media pressure",
      "Track conversion by ticket category"
    ],
    "confidence": 73
  },
  "risks": {
    "overallRiskScore": 42,
    "overallRiskLevel": "medium",
    "items": [
      {
        "title": "Sponsor revenue shortfall",
        "category": "sponsors",
        "severity": "medium",
        "reason": "The plan depends on INR 13.5L+ sponsor revenue to exceed the target comfortably.",
        "mitigation": "Start sponsor outreach immediately and create at least three package levels.",
        "approvalImpact": "Review sponsor plan before executing sponsor-related tasks."
      },
      {
        "title": "Premium ticket conversion risk",
        "category": "ticketing",
        "severity": "medium",
        "reason": "Revenue target depends on strong premium category sales.",
        "mitigation": "Use early-bird scarcity and premium positioning in the first campaign window.",
        "approvalImpact": "Review ticket strategy before creating ticket categories."
      },
      {
        "title": "Production cost pressure",
        "category": "budget",
        "severity": "high",
        "reason": "Premium production for a headline artist can exceed initial budget assumptions.",
        "mitigation": "Lock vendor quotes early and reserve contingency budget.",
        "approvalImpact": "Budget should be reviewed before final approval."
      }
    ],
    "confidence": 80
  },
  "taskChecklist": {
    "tasks": [
      {
        "title": "Finalize event venue shortlist",
        "description": "Compare venue options for 1500-seat capacity, stage readiness, parking, and sponsor branding.",
        "priority": "high",
        "dueDate": "2026-07-05",
        "ownerRole": "Operations",
        "approvalRequired": true
      },
      {
        "title": "Prepare sponsor proposal deck",
        "description": "Create sponsor packages, audience profile, benefit inventory, and pricing.",
        "priority": "high",
        "dueDate": "2026-07-10",
        "ownerRole": "Sponsorship",
        "approvalRequired": true
      },
      {
        "title": "Draft ticket category plan",
        "description": "Prepare VIP, Diamond, Gold, and Silver category structure with inventory and price assumptions.",
        "priority": "high",
        "dueDate": "2026-07-12",
        "ownerRole": "Ticketing",
        "approvalRequired": true
      },
      {
        "title": "Prepare marketing launch assets",
        "description": "Create announcement poster, teaser content, and first campaign calendar.",
        "priority": "medium",
        "dueDate": "2026-07-20",
        "ownerRole": "Marketing",
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
        "description": "Create four planning tasks from the approved blueprint.",
        "approvalLevel": 1,
        "riskLevel": "low",
        "actionCount": 4,
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
      "createTasks": 4,
      "createTimelineItems": 3,
      "createTicketCategories": 0,
      "createSponsors": 0,
      "createFinanceRecords": 0
    }
  },
  "metadata": {
    "generatedAt": "2026-06-26T10:00:00+05:30",
    "generatedBy": "gemini",
    "model": "gemini-2.0-flash",
    "agentsUsed": [
      "planner",
      "sponsor",
      "finance",
      "risk"
    ],
    "researchUsed": false,
    "memoryUsed": false,
    "sourceRequestId": "req_2026_001",
    "assumptions": [
      "Venue is not confirmed; planning uses city-level venue assumptions.",
      "Artist fee is estimated because no confirmed artist commercial terms were provided.",
      "Sponsor names are category-level placeholders unless verified by research.",
      "Ticket sell-through is estimated and not based on live sales data."
    ],
    "warnings": [
      "Revenue estimate confidence is medium because ticket sales history is unavailable.",
      "MVP must not create sponsor or finance records from this blueprint."
    ],
    "schemaNotes": [
      "Contract v1 follows Command -> Clarification -> Blueprint -> Approval -> Execution -> History -> Memory.",
      "Execution preview is approval-gated and limited to MVP-safe records."
    ]
  }
}
```

## Final Rule

The Blueprint JSON Contract is the single source of truth for AI-generated blueprints.

If an AI output cannot be validated against this contract, it is not a blueprint. It is only untrusted model text.

EventOS AI must always choose safety over convenience.
