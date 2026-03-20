# Work Item Rules

## The Core Question

Before creating a work item, ask: **Does this thread require coordinated, trackable effort that
I will need to find again, follow up on, or hand off?**

If yes → create a work item.
If no → leave the thread in the unified inbox (it will scroll away naturally) or ignore it.

---

## Create a Work Item When

A thread qualifies for a work item if one or more of these is true:

1. **You need to take action and it is not a simple immediate reply.**
   The response requires research, coordination, or time you don't have right now.

2. **The thread involves scheduling, commitment, or coordination with multiple parties.**
   Booking a venue, arranging a meeting, confirming a budget — anything where multiple people
   need to align before it's resolved.

3. **The thread has a deadline or time-sensitive deliverable.**
   Permit applications, event registrations, RSVPs with a cutoff date.

4. **You need to follow up after your reply.**
   You sent a message and you need to remember to check back if you don't hear back.
   (This is the WAITING state — you've acted, but work isn't done.)

5. **The thread is part of an ongoing project or initiative.**
   It's one of many emails about the same underlying effort. Spring Banquet planning, Eagle Scout
   board review, budget cycle.

6. **You need to link it to another thread from a different account.**
   Two separate inboxes are receiving email about the same real-world thing. A work item is the
   only object that can span accounts.

---

## Do NOT Create a Work Item When

These threads should remain in the unified inbox without a work item:

- **Automated notifications and receipts** — order confirmations, payment receipts, delivery
  alerts, calendar invite confirmations. No action needed beyond reading.
- **FYI broadcasts** — newsletters, school bulletins, district announcements where you are one
  of many recipients and no personal action is expected.
- **Solicitations and spam** — fundraising appeals, sales pitches, unsolicited pitches.
- **Simple one-line acknowledgments you've already sent** — "Thanks, got it." The thread is over.
- **Informational reads** — meeting notes sent for awareness, Troop roster updates,
  shared documents where you just need to read and move on.

When in doubt, do not create a work item. The unified intake is not a backlog; it is a triage
queue. Not everything that arrives deserves promotion.

---

## Domain Assignment

### In V1 (Manual Only)

Domain assignment is always a user action. The app does not automatically assign threads to
domains until Phase 4 (rules engine).

Assign a domain when:
- The thread clearly maps to one of your responsibility areas
- You are creating a work item (domain required before saving)

Leave unassigned when:
- It is genuinely ambiguous (a thread from a friend who is also a church contact, for example)
- You want to triage domain assignment separately from work-item creation

### Heuristics for Manual Assignment (No Automation Yet)

Use these rules of thumb when deciding which domain:

| Signal | Likely domain |
|---|---|
| Received on troop42@gmail.com | Troop 42 |
| From a @bsa-hod.org address | Heart of Dallas District |
| Received on admin@educatorr.com | EducatOrr |
| From church staff or church@lhcc.org | Lake Highlands Church |
| From sjes.org addresses | SJES |
| From family members or personal contacts | Personal |
| Ambiguous — multiple domains involved | Pick the primary one; note the other in work item notes |

### Phase 4 Automation (Preview)

In Phase 4, the Rules engine will surface suggestions (not auto-assignments by default) based on:
- Sender email address (`from:scoutmaster@troop42.org` → suggest Troop 42)
- Receiving account (account known to be domain-specific)
- Subject keywords (`banquet`, `budget`, `board review`)
- Participant lists (if most participants are known Troop 42 contacts)

Rules will **suggest** a domain, not assign it automatically, unless the user explicitly opts in
to auto-assignment for that rule. This keeps the user in control during V1 and Phase 4.

---

## What Metadata Determines a Work Item's Identity

A work item is a human-created object, not an automatically derived one. The app does not
detect work items from thread content. Instead, the user:

1. Sees a thread in the unified inbox or domain pile view
2. Decides it qualifies as a work item
3. Hits "+ Work Item" and writes a short title
4. Assigns a domain
5. Optionally adds the triggering thread immediately

The **title** is the primary identity. It should be a plain-English label for the real-world
effort, not a copy of the email subject line.

Good titles:
- "Spring Banquet 2026"
- "Eagle Scout Board — James Turner"
- "Q2 Budget Approval — EducatOrr"

Poor titles (these are email subjects, not work item names):
- "RE: RE: FW: venue question"
- "Follow-up from last week"
- "Help needed"

---

## When to Push to Todoist vs. Keep in App

Keep in the app (work item with status) when:
- The thread is the primary tracking mechanism
- You're waiting for a reply before you can do more
- The item will resolve within a few exchanges
- You don't need subtasks, reminders, or recurrence

Push to Todoist when:
- The item has multiple independent subtasks that need their own lifecycle
- You need date-based reminders you'll actually act on
- The item needs to integrate with your broader Todoist project structure
- You want it to appear in your daily Todoist review

A work item that is exported to Todoist moves to `TODOIST` status. It is not deleted from the
app — the thread links, notes, and history remain here for context. The task management happens
in Todoist; the email context lives here.
