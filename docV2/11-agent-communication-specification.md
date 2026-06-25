EventOS AI V2 – Agent Communication Specification Document (ACSD) v1.0
======================================================================

1\. Purpose
-----------

Defines how AI agents communicate, collaborate, and coordinate.

Goal:

Multiple agents work together like a professional event company.

2\. Philosophy
==============

Bad System:

One giant AI prompt.

Good System:

Specialized agents.

World-Class System:

Specialized agents coordinated by an orchestrator.

3\. Core Principle
==================

Agents never directly talk to database.

Agents never directly execute actions.

Agents produce structured outputs.

Only the Orchestrator can:

*   Route work

*   Merge outputs

*   Request approvals

*   Trigger execution

4\. Agent Hierarchy
===================

Top Level:

AI Orchestrator

Below:

Planner Agent

Sponsor Agent

Finance Agent

Marketing Agent

Ticketing Agent

Vendor Agent

Artist Agent

Operations Agent

Risk Agent

Reporting Agent

5\. AI Orchestrator
===================

Location:

packages/ai/orchestrator

Responsibilities:

*   Understand user intent

*   Select agents

*   Manage workflow

*   Merge outputs

*   Build blueprint

*   Request approvals

Orchestrator is the CEO.

6\. Planner Agent
=================

Purpose:

Convert user goals into event plans.

Input:

User Intent

Output:

*   Event Blueprint

*   Milestones

*   Tasks

*   Timeline

Example:

Create comedy show for 1500 people.

Planner creates structure.

7\. Sponsor Agent
=================

Purpose:

Generate sponsorship strategy.

Input:

Event Blueprint

Output:

*   Sponsor categories

*   Sponsor targets

*   Sponsor packages

*   Pitch suggestions

*   Outreach strategy

8\. Finance Agent
=================

Purpose:

Build event economics.

Input:

Blueprint

Output:

*   Revenue forecast

*   Cost forecast

*   Break-even

*   Profit estimate

*   Financial risks

9\. Ticketing Agent
===================

Purpose:

Create ticket strategy.

Output:

*   Ticket categories

*   Pricing

*   Inventory

*   Sales assumptions

10\. Marketing Agent
====================

Purpose:

Create promotion strategy.

Output:

*   Launch plan

*   Campaign plan

*   Content ideas

*   Channel recommendations

11\. Vendor Agent
=================

Purpose:

Plan event infrastructure.

Output:

*   Vendor requirements

*   Vendor categories

*   Vendor checklist

12\. Artist Agent
=================

Purpose:

Handle artist operations.

Output:

*   Artist requirements

*   Hospitality

*   Travel

*   Accommodation

*   Contract checklist

13\. Operations Agent
=====================

Purpose:

Run event operations.

Output:

*   Show-day plan

*   Team assignments

*   Readiness checklist

14\. Risk Agent
===============

Purpose:

Analyze risk across all outputs.

Input:

All agent outputs.

Output:

*   Risks

*   Severity

*   Recommendations

Risk Agent is always last.

15\. Reporting Agent
====================

Purpose:

Create human-readable documents.

Output:

*   Executive summaries

*   PDF reports

*   Sponsor decks

*   Blueprint exports

16\. Communication Pattern
==========================

User

↓

Orchestrator

↓

Agents

↓

Orchestrator

↓

Blueprint

Agents never communicate directly.

All communication goes through orchestrator.

17\. Agent Input Contract
=========================

Every agent receives:

*   Workspace Context

*   Event Context

*   Memory Context

*   Knowledge Context

*   Research Context

*   User Intent

Standardized format.

18\. Agent Output Contract
==========================

Every agent returns:

*   Findings

*   Recommendations

*   Risks

*   Confidence Score

*   Structured JSON

No free-form outputs.

19\. Agent Confidence
=====================

Each response contains:

0–100 confidence.

Example:

Finance Forecast

Confidence: 88

Sponsor Research

Confidence: 72

Users can judge reliability.

20\. Agent Memory Access
========================

Agents may read:

*   Event Memory

*   Workspace Memory

*   Knowledge Assets

Agents may not directly write memory.

Memory updates happen through Learning Engine.

21\. Agent Research Access
==========================

Agents can request research.

Example:

Sponsor Agent requests:

Find local sponsors.

Research Engine responds.

Agent uses results.

22\. Agent Conflict Resolution
==============================

Example:

Finance Agent:

Budget too high.

Marketing Agent:

Needs larger budget.

Conflict sent to:

Orchestrator

Orchestrator resolves.

23\. Blueprint Assembly
=======================

Orchestrator merges:

Planner

Sponsor

Finance

Marketing

Ticketing

Vendor

Artist

Operations

Risk

↓

Unified Blueprint

24\. Execution Boundary
=======================

Agents cannot:

*   Create records

*   Delete records

*   Modify finances

*   Send emails

*   Send WhatsApp

Agents only recommend.

Execution Engine acts after approval.

25\. Learning Feedback Loop
===========================

After event completion:

Outcomes

↓

Learning Engine

↓

Memory

↓

Future Agent Context

Agents become smarter over time.

26\. Future Multi-Agent Flow
============================

User:

Create Sunil Grover show in Ahmedabad.

Orchestrator:

Runs Planner.

Planner creates event structure.

Sponsor Agent creates sponsorship strategy.

Finance Agent forecasts profitability.

Ticketing Agent creates pricing.

Marketing Agent creates campaigns.

Operations Agent creates readiness plan.

Risk Agent analyzes risks.

Reporting Agent creates final blueprint.

Orchestrator merges everything.

User receives one response.

27\. Failure Handling
=====================

If one agent fails:

System continues.

Example:

Marketing Agent fails.

Blueprint still generated.

Marketing section marked:

Needs Review.

28\. Agent Isolation
====================

Agents are isolated.

Planner Agent cannot corrupt Finance Agent.

Sponsor Agent cannot overwrite Vendor Agent.

All outputs validated independently.

29\. Agent Communication North Star
===================================

The user should never see agents.

The user talks to EventOS AI.

Internally:

A complete AI event company collaborates to produce the result.
