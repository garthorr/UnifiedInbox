# UnifiedInbox — Email Work Console

A personal Gmail-connected operations dashboard that turns email from multiple accounts into
organized work items grouped by life, business, and volunteer domains.

> **Status:** Phase 0 complete — definition and design locked. Ready for Phase 1 implementation.

---

## What This Is

A private web app that sits on top of multiple Gmail accounts and helps convert email into
organized work without changing how senders interact with you. Gmail remains the system of
record. The app adds a coordination layer on top.

In one sentence: **a cross-account work console that groups related threads into work items
organized by responsibility area.**

---

## Domains

| Domain | Description |
|---|---|
| Troop 42 | BSA Troop 42 parent/leader communications |
| Heart of Dallas District | BSA district-level coordination |
| EducatOrr | EducatOrr nonprofit operations |
| Lake Highlands Church | Church volunteer and staff communications |
| SJES | St. John Episcopal School liaison |
| Personal | Family and personal life |

---

## Phase 0 Deliverables

| Document | Description |
|---|---|
| [Product Spec](docs/product-spec.md) | Problem, outcome, principles, non-goals |
| [Data Model](docs/data-model.md) | 7 entity definitions + draft Prisma schema |
| [Status Model](docs/status-model.md) | Work item lifecycle, transitions, colors |
| [Gmail Metadata](docs/gmail-metadata.md) | What is mirrored vs. read-only; sync strategy |
| [Work Item Rules](docs/work-item-rules.md) | When email becomes a work item; domain assignment |
| [Wireframes](docs/wireframes.md) | ASCII wireframes for 5 key screens |
| [Edge Cases](docs/edge-cases.md) | 12 edge cases with resolution |

---

## Roadmap

| Phase | Goal | Status |
|---|---|---|
| 0 | Definition and design | **Complete** |
| 1 | MVP: OAuth, sync, unified inbox, domains, work items | Pending |
| 2 | Daily usability: saved views, notes, search, activity log | Pending |
| 3 | Todoist integration | Pending |
| 4 | Rules engine and auto-suggestions | Pending |
| 5 | Local AI (Ollama) assistance | Pending |
| 6 | Mature console: OpenProject, calendar, mobile | Pending |

---

## Planned Tech Stack (Phase 1)

| Layer | Choice |
|---|---|
| Frontend | Next.js + Tailwind + shadcn/ui |
| Backend | Next.js API routes |
| Database | PostgreSQL + Prisma |
| Auth | Google OAuth (Gmail API) |
| Background jobs | Node workers for sync |
| Hosting | Self-hosted Docker (V1) |
| AI | Local Ollama endpoint (Phase 5) |

---

## Phase 1 First Milestone

Connect two Gmail accounts, view a unified inbox, create one work item called "Spring Banquet,"
and attach three related threads from two separate inboxes to it.
