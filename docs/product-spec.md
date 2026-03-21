# Product Spec — Email Work Console

## Problem

Managing email-driven work across multiple Gmail accounts and volunteer/professional roles is
fragmented and context-switching-heavy. A typical day involves five separate mailboxes — personal,
two BSA roles, a nonprofit, a church role, and a school — with no unified view of what needs
attention, no way to group related threads that arrive in different inboxes, and no clear boundary
between "read this" and "do something about this."

The result: things fall through the cracks, follow-ups are late, and triage happens inside Gmail
itself — which is not designed for work coordination.

## Intended Outcome

A private, personal dashboard that:

1. Pulls thread metadata from all connected Gmail accounts into one place
2. Organizes threads by real-world responsibility area (domain) rather than by mailbox
3. Lets the user group one or more related threads — from any account — into a single work item
4. Enables pile-based processing: open one domain at a time and work that pile
5. Surfaces only the threads and items that deserve attention, not everything
6. Exports durable follow-up tasks to Todoist when a work item needs a full task lifecycle

## Core Principles

- **Gmail is the system of record.** The app mirrors metadata; it does not replace or duplicate
  Gmail. Replies are sent from Gmail. Search is done in Gmail. The app never becomes a mail
  client.
- **Read-only in V1.** The app does not write labels, archive threads, or modify anything in Gmail
  during the initial release. All Gmail state is authoritative and untouched.
- **The top-level object is a work item, not a thread.** A thread is a source of information.
  A work item is the unit of effort.
- **A mailbox is a source, not the organizing concept.** Domains organize work. Accounts are
  just pipes.
- **Not every email becomes a work item.** Most correspondence is informational. Only threads
  that require coordinated, trackable effort get promoted.
- **One thread belongs to at most one work item.** A thread can be unlinked, but it cannot be
  attached to two work items simultaneously.
- **Automation assists; it does not silently act.** Suggestions are surfaced for user approval.
  No automatic writes to Gmail, Todoist, or any external system without an explicit user action.
- **Write-back to external systems is explicit and auditable.** Every export to Todoist is
  logged and stored so nothing is sent twice.

## Domains (Initial Set)

| Domain | Description |
|---|---|
| Troop 42 | BSA Troop 42 parent/leader communications |
| Heart of Dallas District | BSA district-level coordination |
| EducatOrr | EducatOrr nonprofit operations |
| Lake Highlands Church | Church volunteer and staff communications |
| SJES | St. John Episcopal School liaison |
| Personal | Family and personal life |

Domains are user-defined and can be added, renamed, or reordered at any time.

## Non-Goals

- **No mail server.** The app does not send, receive, or store email. Gmail does.
- **No replacement for Gmail search, labels, or compose.** Those stay in Gmail.
- **No customer-facing or team-facing interface.** This is a private personal dashboard.
  Correspondents never see it or know it exists.
- **No automatic task creation.** Every work item and Todoist export is an intentional user
  action.
- **No silent destructive actions.** Nothing is deleted from Gmail, Todoist, or the database
  without an explicit confirmation.
- **No offline-first or mobile-native app in V1.** Responsive web; mobile optimization is
  Phase 6.

## Success Criteria — Phase 1 Exit

Connect two Gmail accounts, view their threads in a unified inbox, create a work item titled
"Spring Banquet 2026," and attach three related threads from two separate accounts to it.

## Roadmap Phases

| Phase | Goal |
|---|---|
| 0 | Lock the model and workflow before heavy coding (this document) |
| 1 | MVP: OAuth, multi-account sync, unified inbox, domains, work items, thread linking |
| 2 | Daily usability: saved views, search, notes, checklists, due dates, activity log |
| 3 | Todoist integration: export work items, prevent duplicates, backlink |
| 4 | Rules engine: auto-suggest domains, related thread detection |
| 5 | AI layer: Ollama summaries, action extraction, reply drafts |
| 6 | Mature console: OpenProject, calendar, dashboards, mobile |
