EventOS AI V2 – Agent Architecture Document (AAD) v1.0
======================================================

1\. Purpose
-----------

EventOS AI is not a single chatbot.

EventOS AI is a multi-agent event operating system.

Each agent is responsible for one domain of event operations.

The user does not manually select agents.

The AI Orchestrator decides which agents are needed based on the command.

2\. Agent System Philosophy
===========================

User gives one command.

Example:

Create a 1500-seat Sunil Grover comedy show in Ahmedabad with ₹50L revenue target.

The system activates multiple agents:

*   Planner Agent

*   Ticketing Agent

*   Sponsor Agent

*   Finance Agent

*   Marketing Agent

*   Artist Agent

*   Vendor Agent

*   Operations Agent

*   Risk Agent

Each agent prepares its part of the blueprint.

The Orchestrator merges everything into one Event Blueprint.

3\. Core Agent Rule
===================

Agents can:

*   Analyze

*   Research

*   Plan

*   Draft

*   Recommend

*   Prepare actions

Agents cannot:

*   Create records

*   Send messages

*   Modify money

*   Delete data

*   Approve their own actions

without user approval.

4\. AI Orchestrator
===================

Role
----

The AI Orchestrator is the central brain.

It receives the user command and decides:

*   What is the user trying to do?

*   What information is missing?

*   Which agents are needed?

*   What order should agents run in?

*   What final blueprint should be generated?

*   What needs user approval?

Input
-----

*   User command

*   Workspace context

*   Event history

*   Existing event data

*   User preferences

Output
------

*   Clarification questions

*   Agent execution plan

*   Final Event Blueprint

*   Approval plan

Example
-------

User:

Create a comedy show in Ahmedabad for 1500 people with ₹50L target.

Orchestrator detects:

*   Event type: Comedy Show

*   City: Ahmedabad

*   Capacity: 1500

*   Revenue goal: ₹50L

*   Missing: date, venue, marketing budget, ticket strategy

It asks questions first.

Then activates:

*   Planner Agent

*   Ticketing Agent

*   Sponsor Agent

*   Finance Agent

*   Marketing Agent

*   Operations Agent

5\. Planner Agent
=================

Purpose
-------

Creates the overall event blueprint.

Responsibilities
----------------

*   Event structure

*   Event phases

*   Planning checklist

*   Core milestone plan

*   Coordination map

Inputs
------

*   Event type

*   City

*   Capacity

*   Budget

*   Revenue target

*   Date

*   Audience type

Outputs
-------

*   Event plan

*   Milestones

*   Planning checklist

*   Core tasks

*   Recommended timeline

Tools
-----

*   Event templates

*   Workspace history

*   Event type library

*   Knowledge Engine

Approval Required For
---------------------

*   Creating event record

*   Creating tasks

*   Creating timeline items

6\. Ticketing Agent
===================

Purpose
-------

Designs ticket strategy.

Responsibilities
----------------

*   Ticket categories

*   Pricing

*   Inventory distribution

*   Revenue projection

*   Sales risk

*   Ticket promotion strategy

Inputs
------

*   Capacity

*   Revenue goal

*   Audience profile

*   Event type

*   City

*   Historical ticket data

Outputs
-------

*   Ticket categories

*   Price suggestions

*   Revenue forecast

*   Sales risk

*   Ticket promotion plan

Example Output
--------------

*   VIP: ₹10,000

*   Diamond: ₹5,000

*   Gold: ₹3,000

*   Silver: ₹1,500

Approval Required For
---------------------

*   Creating ticket categories

*   Updating ticket inventory

*   Changing ticket prices

7\. Sponsor Agent
=================

Purpose
-------

Creates sponsorship strategy.

Responsibilities
----------------

*   Sponsor categories

*   Sponsor package ideas

*   Local sponsor research

*   Sponsor pitch draft

*   Sponsor email draft

*   Follow-up task plan

Inputs
------

*   Event type

*   City

*   Audience

*   Revenue goal

*   Sponsor history

*   Web research

Outputs
-------

*   Sponsor strategy

*   Sponsor category list

*   Suggested local sponsors

*   Sponsorship packages

*   Pitch deck outline

*   Proposal email draft

*   Follow-up tasks

Example Sponsor Categories
--------------------------

*   Real Estate

*   Jewellery

*   Automobile

*   Hotels

*   Education

*   Hospitals

*   Lifestyle Brands

Approval Required For
---------------------

*   Creating sponsor records

*   Creating sponsor follow-up tasks

*   Sending sponsor emails

*   Sending WhatsApp messages

8\. Finance Agent
=================

Purpose
-------

Checks if the event can make money.

Responsibilities
----------------

*   Revenue forecast

*   Cost forecast

*   Break-even analysis

*   Profit risk

*   Cash flow estimate

*   Budget warning

Inputs
------

*   Ticket plan

*   Sponsor plan

*   Vendor costs

*   Artist costs

*   Marketing budget

*   Venue cost

Outputs
-------

*   Revenue forecast

*   Expense forecast

*   Profit estimate

*   Break-even point

*   Risk level

*   Finance recommendations

Approval Required For
---------------------

*   Creating finance records

*   Updating budgets

*   Marking payments

*   Sending invoices

9\. Marketing Agent
===================

Purpose
-------

Creates launch and promotion plan.

Responsibilities
----------------

*   Campaign strategy

*   Social media calendar

*   WhatsApp campaign plan

*   Poster concepts

*   Video/reel ideas

*   Ad budget suggestions

*   Influencer plan

Inputs
------

*   Event type

*   City

*   Audience

*   Ticket plan

*   Revenue target

*   Marketing budget

Outputs
-------

*   30-day marketing plan

*   Instagram content ideas

*   WhatsApp broadcast drafts

*   Poster copy

*   Reel/video ideas

*   Ad spend plan

Approval Required For
---------------------

*   Sending WhatsApp messages

*   Sending emails

*   Posting on social media

*   Creating marketing tasks

10\. Artist Agent
=================

Purpose
-------

Manages artist requirements.

Responsibilities
----------------

*   Artist checklist

*   Travel plan

*   Hotel plan

*   Contract checklist

*   Hospitality rider

*   Performance schedule

Inputs
------

*   Artist name

*   Event date

*   City

*   Venue

*   Budget

*   Event type

Outputs
-------

*   Artist logistics checklist

*   Estimated requirements

*   Contract checklist

*   Hospitality plan

*   Stage/performance timing

Approval Required For
---------------------

*   Creating artist records

*   Updating artist payment status

*   Sending artist communication

11\. Vendor Agent
=================

Purpose
-------

Plans production vendors.

Responsibilities
----------------

*   Stage

*   Sound

*   Lighting

*   LED

*   Security

*   Decoration

*   Seating

*   Backup vendors

Inputs
------

*   Event type

*   Capacity

*   Venue

*   City

*   Budget

*   Timeline

Outputs
-------

*   Vendor category plan

*   Production checklist

*   Vendor requirement list

*   Backup vendor plan

*   Cost estimate

Approval Required For
---------------------

*   Creating vendor records

*   Updating vendor payment status

*   Sending vendor communication

12\. Operations Agent
=====================

Purpose
-------

Ensures event readiness.

Responsibilities
----------------

*   Readiness score

*   Missing items

*   Critical risks

*   Task tracking

*   Timeline tracking

*   Show-day checklist

Inputs
------

*   Tasks

*   Timeline

*   Vendors

*   Artists

*   Tickets

*   Sponsors

*   Finance

Outputs
-------

*   Readiness report

*   Critical task list

*   Missing item report

*   Show-day checklist

*   Final readiness review

Approval Required For
---------------------

*   Creating tasks

*   Updating task status

*   Creating timeline items

13\. Risk Agent
===============

Purpose
-------

Finds what can go wrong.

Responsibilities
----------------

*   Ticket risk

*   Sponsor risk

*   Finance risk

*   Vendor risk

*   Artist risk

*   Timeline risk

*   Marketing risk

Inputs
------

*   All agent outputs

*   Existing event data

*   Historical outcomes

Outputs
-------

*   Risk report

*   Severity rating

*   Recommended mitigation

*   Urgency level

Approval Required For
---------------------

*   Creating mitigation tasks

*   Updating event risk status

14\. Reporting Agent
====================

Purpose
-------

Generates professional reports.

Responsibilities
----------------

*   Event blueprint report

*   Sponsor proposal PDF

*   Finance summary

*   Client-ready report

*   Internal status report

Inputs
------

*   Event Blueprint

*   Finance forecast

*   Sponsor strategy

*   Timeline

*   Risks

Outputs
-------

*   PDF report

*   Word report

*   Sponsor proposal

*   Future pitch deck outline

Approval Required For
---------------------

*   Exporting final documents

*   Sending documents

15\. Agent Communication Flow
=============================

User Command

↓

Orchestrator

↓

Clarification Questions

↓

Agent Execution Plan

↓

Agents Generate Drafts

↓

Orchestrator Merges Drafts

↓

Event Blueprint

↓

User Approval

↓

Execution Engine

16\. Agent Output Standard
==========================

Every agent output must include:

*   Summary

*   Recommendations

*   Risks

*   Draft actions

*   Approval requirements

*   Confidence level

*   Source data used

17\. Agent Memory
=================

Agents can access:

*   Current event context

*   Workspace history

*   Past event outcomes

*   Sponsor history

*   Vendor history

*   Ticket sales history

*   Finance history

Agents should learn patterns over time.

18\. Web Research Rules
=======================

Agents may use web research for:

*   Local sponsors

*   Venue options

*   Market pricing

*   Artist info

*   Industry trends

Web research cannot directly create records.

It only creates recommendations.

19\. Safety Rules
=================

AI cannot execute sensitive actions without approval.

Sensitive actions:

*   Create event

*   Create sponsor

*   Create vendor

*   Create artist

*   Create finance record

*   Send WhatsApp

*   Send email

*   Modify payment

*   Delete records

20\. Event Blueprint Agent Bundle
=================================

For a full event command, these agents run together:

*   Planner Agent

*   Ticketing Agent

*   Sponsor Agent

*   Finance Agent

*   Marketing Agent

*   Artist Agent

*   Vendor Agent

*   Operations Agent

*   Risk Agent

*   Reporting Agent

Final output:

Complete Event Blueprint.

21\. V2 Agent North Star
========================

EventOS AI should feel like:

A senior event company team working inside one AI system.

Planner.

Sponsor manager.

Marketing head.

Finance controller.

Operations manager.

All working together.

The user only gives direction and approval.
