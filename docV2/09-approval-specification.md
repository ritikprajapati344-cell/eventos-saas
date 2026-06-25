EventOS AI V2 – Approval Specification Document (ASD) v1.0
==========================================================

1\. Purpose
-----------

Approval System controls what AI is allowed to do.

Goal:

Enable AI automation while maintaining human control.

Core Principle:

AI may think.

AI may recommend.

AI may prepare.

AI may draft.

AI may never execute sensitive actions without approval.

2\. Approval Philosophy
=======================

Traditional Software:

User performs actions manually.

EventOS AI:

AI prepares actions.

User approves actions.

System executes actions.

3\. Human-in-the-Loop Rule
==========================

Every important business action requires a human decision.

Flow:

AI Suggests

↓

User Reviews

↓

User Approves

↓

Execution Engine Executes

4\. Approval Levels
===================

Level 0

No Approval Needed

Level 1

Simple Approval

Level 2

Business Approval

Level 3

Sensitive Approval

Level 4

Critical Approval

5\. Level 0 – No Approval Needed
================================

AI can do:

*   Analyze data

*   Generate reports

*   Explain risks

*   Generate recommendations

*   Build drafts

*   Generate blueprints

Reason:

No records are changed.

6\. Level 1 – Simple Approval
=============================

Approval required before:

*   Creating tasks

*   Creating timeline items

*   Creating ticket categories

*   Creating reports

Example:

AI proposes:

47 tasks.

User approves.

Tasks created.

7\. Level 2 – Business Approval
===============================

Approval required before:

*   Creating sponsors

*   Creating vendors

*   Creating artists

*   Creating marketing campaigns

*   Creating finance forecasts

Reason:

Business records are being created.

8\. Level 3 – Sensitive Approval
================================

Approval required before:

*   Sending emails

*   Sending WhatsApp messages

*   Creating calendar events

*   Creating CRM actions

*   Uploading documents externally

Reason:

External communication.

9\. Level 4 – Critical Approval
===============================

Highest approval level.

Required for:

*   Deleting records

*   Modifying finances

*   Changing budgets

*   Updating contracts

*   Payment actions

*   Financial commitments

Reason:

Can directly impact money or legal agreements.

10\. Approval Modes
===================

Mode 1

Approve Entire Blueprint

User approves everything at once.

Example:

Approve Entire Event Plan

Mode 2

Approve Module

Examples:

Approve Sponsors

Approve Tasks

Approve Marketing

Approve Timeline

Mode 3

Approve Individual Action

Examples:

Approve only one sponsor.

Approve only one task.

Approve only one timeline item.

11\. Approval Objects
=====================

Every approval item contains:

*   Approval ID

*   Title

*   Description

*   Module

*   Risk Level

*   Action Count

*   Approval Level

*   Status

12\. Approval Statuses
======================

proposed

approved

rejected

executed

failed

undone

expired

13\. Blueprint Approval Flow
============================

User Command

↓

AI Generates Blueprint

↓

Blueprint Review

↓

Approval Selection

↓

Execution Preview

↓

User Confirmation

↓

Execution

14\. Execution Preview Requirement
==================================

Before execution:

AI must show:

What will be created.

What will change.

How many records will be created.

Examples:

1 Event

47 Tasks

12 Timeline Items

4 Ticket Categories

Nothing executes before preview.

15\. Multi-Step Approval
========================

For sensitive actions:

Two-step approval.

Example:

Send sponsor outreach emails.

Step 1

Approve Drafts

Step 2

Approve Sending

Only then:

Send.

16\. Approval Expiry
====================

Approvals should expire.

Example:

Marketing campaign approved 90 days ago.

System requests re-approval.

Reason:

Old approvals become unsafe.

17\. Bulk Approval
==================

Allowed for:

*   Tasks

*   Timeline

*   Ticket Categories

Example:

Approve all 50 tasks.

One click.

18\. Restricted Bulk Approval
=============================

Not allowed for:

*   Payments

*   Contract changes

*   Finance changes

*   External communication

Must be individually reviewed.

19\. Approval Audit Trail
=========================

Every approval stores:

*   User

*   Time

*   Action

*   Reason

*   Result

Nothing is anonymous.

20\. Undo Rules
===============

Every executable action should support rollback when possible.

Examples:

Task creation

Timeline creation

Ticket category creation

Sponsor creation

Vendor creation

Undo supported.

21\. Non-Reversible Actions
===========================

Some actions cannot be fully undone.

Examples:

Email sent

WhatsApp sent

External file shared

System records audit trail.

22\. AI Self-Approval Rule
==========================

AI can never approve itself.

Forbidden:

AI creates sponsor.

AI approves sponsor.

AI executes sponsor.

This is not allowed.

Human approval required.

23\. Workspace Permissions
==========================

Future Enterprise Support

Owner

Manager

Operations

Marketing

Finance

Each role has different approval rights.

Example:

Finance Manager approves finance actions.

Marketing Manager approves campaigns.

24\. Approval Risk Labels
=========================

Every approval receives:

Low Risk

Medium Risk

High Risk

Critical Risk

Examples:

Create task

Low

Send sponsor email

Medium

Create sponsor

High

Modify payment

Critical

25\. Agent Approval Rules
=========================

Planner Agent

Needs approval before creating tasks.

Ticketing Agent

Needs approval before ticket creation.

Sponsor Agent

Needs approval before sponsor creation.

Marketing Agent

Needs approval before campaign execution.

Finance Agent

Needs approval before finance changes.

Vendor Agent

Needs approval before vendor creation.

Artist Agent

Needs approval before artist creation.

Operations Agent

Needs approval before operational changes.

26\. Approval Screen
====================

Dedicated screen.

Sections:

Pending

Approved

Rejected

Executed

Undone

Expired

Searchable and filterable.

27\. Approval Notifications
===========================

Future:

Email

WhatsApp

Mobile Push

In-App

Examples:

5 approvals pending.

Marketing campaign awaiting review.

28\. Approval Safety Layer
==========================

Execution Engine cannot run without:

Valid Approval

Workspace Permission

Audit Log Entry

Execution Plan

If any fail:

Execution blocked.

29\. Approval North Star
========================

EventOS AI should feel powerful.

But never dangerous.

AI prepares everything.

Humans stay in control.

Always.
