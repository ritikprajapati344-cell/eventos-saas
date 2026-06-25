EventOS AI V2 – System Architecture Blueprint (SAB) v1.0
========================================================

1\. Purpose
-----------

This document defines the technical system structure for EventOS AI V2.

Goal:

Build EventOS AI as an AI-native Event Operating System, not a traditional SaaS with AI features.

2\. Architecture Philosophy
===========================

EventOS V1:

Pages first.

Forms first.

Manual operations first.

EventOS AI V2:

Command first.

Agents first.

Approval first.

Execution after approval.

3\. Proposed Monorepo Structure
===============================

eventos/

apps/web/mobile/

agents/planner/sponsor/marketing/finance/ticketing/vendor/artist/operations/risk/reporting/

packages/ui/database/ai/memory/knowledge/approvals/execution/research/analytics/exports/

docs/vision/prd/trd/ux/architecture/agents/roadmap/

infra/supabase/edge-functions/vercel/

4\. Apps Layer
==============

apps/web
--------

Main browser application.

Contains:

*   EventOS AI Command Center

*   My Events

*   Approvals

*   History

*   Reports

*   Settings

This becomes the primary user interface.

apps/mobile
-----------

Future mobile app.

Purpose:

*   Voice commands

*   Approval on phone

*   Show-day operations

*   Team task tracking

*   Notifications

Not MVP priority.

5\. Agents Layer
================

Agents are domain-specific AI workers.

Each agent owns one business domain.

Agents do not directly write to database.

Agents produce structured outputs.

Execution requires approval.

Agent folders:

agents/planner
--------------

Creates event blueprint, milestones, and task plans.

agents/sponsor
--------------

Creates sponsor strategy, packages, pitch drafts, follow-up plans.

agents/marketing
----------------

Creates campaign plans, content ideas, launch calendars.

agents/finance
--------------

Creates revenue forecast, expense forecast, profit analysis.

agents/ticketing
----------------

Creates ticket categories, pricing, inventory strategy.

agents/vendor
-------------

Creates vendor requirement plans.

agents/artist
-------------

Creates artist logistics and contract checklist.

agents/operations
-----------------

Creates readiness plans and show-day operations checklist.

agents/risk
-----------

Analyzes risk across all domains.

agents/reporting
----------------

Creates reports, PDFs, proposals, summaries.

6\. Packages Layer
==================

Shared engines used by apps and agents.

packages/ui
-----------

Reusable UI system.

Contains:

*   Command Box

*   Agent Status Panel

*   Blueprint Cards

*   Approval Cards

*   Execution Preview

*   History Timeline

*   Risk Cards

*   Report Viewer

Goal:

Make EventOS AI feel premium, clean, and consistent.

packages/database
-----------------

Supabase access layer.

Contains:

*   Repositories

*   Types

*   Query helpers

*   Workspace scoping

*   RLS-safe operations

No UI logic.

packages/ai
-----------

AI model abstraction.

Contains:

*   Model router

*   Prompt templates

*   Response parsers

*   JSON validators

*   Provider adapters

Providers:

*   Gemini

*   OpenAI

*   Claude future

*   Local models future

packages/memory
---------------

Long-term memory system.

Stores:

*   Workspace history

*   Event memory

*   Sponsor memory

*   Vendor memory

*   Marketing memory

*   Finance patterns

Purpose:

AI should learn from previous events.

packages/knowledge
------------------

Event Knowledge Engine.

Combines:

*   Internal database

*   Templates

*   Past event data

*   Industry patterns

*   Event type rules

Used by agents before generating output.

packages/approvals
------------------

Approval system.

Contains:

*   Approval models

*   Approval states

*   Approval rules

*   Approval history

*   Permission checks

Rules:

No execution without approval.

packages/execution
------------------

Execution system.

Executes approved actions.

Actions:

*   Create event

*   Create tasks

*   Create timeline

*   Create ticket categories

*   Create reports

Future:

*   Send WhatsApp

*   Send email

*   Create sponsor records

*   Create vendor records

*   Create finance records

packages/research
-----------------

Web research layer.

Used for:

*   Local sponsor research

*   Venue research

*   Market research

*   Artist research

All research results are recommendations only.

packages/analytics
------------------

Deterministic intelligence.

Contains:

*   Event health

*   Ticket risk

*   Sponsor risk

*   Finance risk

*   Readiness score

*   Revenue gap

This layer should not depend on LLM.

packages/exports
----------------

Document export engine.

Outputs:

*   PDF

*   Word

*   Sponsor proposal

*   Event blueprint report

*   Future pitch deck

7\. Docs Layer
==============

All planning documents live in docs.

docs/vision

Product vision.

docs/prd

Product requirements.

docs/trd

Technical requirements.

docs/ux

User flows and UI philosophy.

docs/architecture

System architecture.

docs/agents

Agent specs.

docs/roadmap

Sprint roadmap.

8\. Infra Layer
===============

infra/supabase
--------------

Contains:

*   Migrations

*   RLS policies

*   Edge function SQL

*   Storage policies

infra/edge-functions
--------------------

Contains:

*   AI command handlers

*   Execution handlers

*   Web research functions

*   Export functions

infra/vercel
------------

Deployment configuration.

9\. Core Runtime Flow
=====================

User command

↓

apps/web Command Center

↓

Command Parser

↓

AI Orchestrator

↓

Clarification Questions

↓

Knowledge Engine

↓

Agents

↓

Blueprint Generator

↓

Approval Engine

↓

Execution Engine

↓

Database

↓

Audit Logs

10\. AI Orchestrator Location
=============================

Recommended location:

packages/ai/orchestrator

Responsibilities:

*   Parse command

*   Decide agents

*   Run agents

*   Merge outputs

*   Validate blueprint

*   Generate approval plan

11\. Event Blueprint Data Model
===============================

Blueprint should be structured JSON.

Sections:

*   event

*   tickets

*   sponsors

*   finance

*   marketing

*   artist

*   vendors

*   timeline

*   tasks

*   risks

*   reports

*   approvals

Blueprint is not execution.

Blueprint is a proposed plan.

12\. Approval Data Model
========================

Every action should have:

*   actionId

*   actionType

*   title

*   description

*   targetModule

*   riskLevel

*   requiresApproval

*   status

Statuses:

*   proposed

*   approved

*   rejected

*   executed

*   failed

*   undone

13\. Execution Data Model
=========================

Every execution should create:

*   executionRun

*   executionItems

*   createdRecordIds

*   status

*   rollbackData

*   timestamps

*   userId

*   workspaceId

Execution must be auditable.

14\. Memory Data Model
======================

Memory types:

*   event\_memory

*   sponsor\_memory

*   vendor\_memory

*   marketing\_memory

*   finance\_memory

*   user\_preference\_memory

Memory should always be workspace-scoped.

15\. Web Research Safety
========================

Research cannot directly create records.

Flow:

Research

↓

Recommendation

↓

User review

↓

Approval

↓

Execution

16\. Security Rules
===================

All writes require:

*   authenticated user

*   workspace membership

*   permission check

*   approval record

*   execution audit

AI cannot bypass RLS.

17\. MVP Implementation Strategy
================================

Do not rewrite everything at once.

Phase 1:

Keep current V1 modules.

Build new AI Command Center shell.

Phase 2:

Extract AI Center components.

Phase 3:

Add blueprint generator.

Phase 4:

Add approval persistence.

Phase 5:

Add execution service.

18\. Migration Strategy
=======================

Current V1 code stays.

V2 builds on top.

Old modules become data engines.

Do not delete:

*   Events

*   Sponsors

*   Tickets

*   Finance

*   Tasks

*   Timeline

They are required for AI execution.

19\. V2 Sidebar
===============

Recommended:

*   EventOS AI

*   My Events

*   Approvals

*   History

*   Reports

*   Settings

*   Advanced Data

Advanced Data contains old modules:

*   Sponsors

*   Artists

*   Vendors

*   Ticketing

*   Finance

*   Expenses

20\. System North Star
======================

EventOS AI should behave like:

An expert event company operating inside software.

The user describes goals.

AI prepares everything.

User approves.

System executes safely.
