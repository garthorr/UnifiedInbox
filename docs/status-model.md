# Work Item Status Model

## Statuses

| Status | Color | Meaning |
|---|---|---|
| **NEW** | Gray `#94a3b8` | Thread has been noticed but not yet evaluated. No action taken. |
| **ACTIVE** | Blue `#3b82f6` | Being worked on right now. Expecting to take next action soon. |
| **WAITING** | Amber `#f59e0b` | A message has been sent. Waiting for a response before next step. |
| **DELEGATED** | Purple `#a855f7` | Handed off to someone else. Monitoring, not driving. |
| **TODOIST** | Green `#22c55e` | Exported to Todoist. Task lifecycle managed there. |
| **DONE** | Slate `#475569` | Resolved. No further action needed. Stays visible but filtered by default. |

---

## Status Descriptions

### NEW
The default state. A work item in NEW means "I know this exists and it might need something,
but I haven't started on it yet." It is the inbox of the work-item layer.

Use case: You create a work item from a thread during morning triage, but you're not starting
on it until this afternoon.

### ACTIVE
Work is in progress. You are the next actor. Something is expected of you.

Use case: You have opened the thread, read it, started drafting a response, or are actively
coordinating something in relation to this item.

### WAITING
You have sent a message or made a request and are waiting for someone else to respond
before you can proceed. The ball is not in your court.

Use case: You emailed the venue coordinator about availability. You're waiting for their reply
before you can finalize the Spring Banquet date.

### DELEGATED
You have handed this work item off to someone else. You're not the driver anymore, but you
want to keep visibility. Different from WAITING because with WAITING you expect a reply
back to you; with DELEGATED someone else owns the work.

Use case: You've asked your committee chair to handle the Eagle Scout paperwork. It's off
your plate but you want to remember it exists.

### TODOIST
This work item has been exported to Todoist and is now tracked there. You may still reference
it here for context, but the task lifecycle (subtasks, reminders, recurrence) lives in Todoist.

Use case: Planning the EducatOrr board meeting agenda. Too many subtasks for the app;
exported to Todoist with the correct project and backlink.

### DONE
The work item is resolved. The thread is closed, the event happened, the follow-up was sent,
or no action turned out to be needed. DONE is terminal — no transitions out by default.

Use case: Spring Banquet happened. The work item is done.

---

## Transition Table

| From | To | Triggering action |
|---|---|---|
| NEW | ACTIVE | User starts working on it |
| NEW | DONE | Resolved without action (e.g. the question answered itself) |
| ACTIVE | WAITING | User sent a message; awaiting reply |
| ACTIVE | DELEGATED | User handed it off to someone else |
| ACTIVE | TODOIST | User exported to Todoist |
| ACTIVE | DONE | User completed the work |
| WAITING | ACTIVE | Reply received; back in progress |
| WAITING | DONE | No longer waiting; resolved without resuming |
| DELEGATED | ACTIVE | Returned to user; now owns it again |
| DELEGATED | DONE | Delegate resolved it |
| TODOIST | ACTIVE | Task removed from Todoist; pulled back |
| TODOIST | DONE | Marked complete in Todoist (optional sync) |
| *(any)* | DONE | Force-close override — user explicitly closes |

---

## Transition Diagram

```
                    ┌──────────┐
         ┌──────────│   NEW    │──────────────┐
         │          └──────────┘              │
         ▼                                    ▼
    ┌──────────┐ ◄────────────────── ┌──────────────┐
    │  ACTIVE  │                     │   WAITING    │
    └──────────┘ ──────────────────► └──────────────┘
         │  │  │
         │  │  └──────────────────► ┌──────────────┐
         │  │                       │  DELEGATED   │
         │  │                       └──────────────┘
         │  │                              │
         │  └──────────────────► ┌─────────────────┐
         │                       │    TODOIST      │
         │                       └─────────────────┘
         │                                │
         └─────────────────────────────────┘
                         │
                         ▼
                    ┌──────────┐
                    │   DONE   │  (terminal)
                    └──────────┘

All statuses can transition directly to DONE via force-close.
```

---

## Rules

1. **DONE is terminal.** There is no transition out of DONE. If you reopen something, create
   a new work item or manually reset (Phase 2 feature).
2. **Status changes are logged.** Every transition creates an `ActivityLog` entry with
   `eventType: WORK_ITEM_STATUS_CHANGED` and metadata recording the old and new status.
3. **Only one export per provider.** A work item in TODOIST status has exactly one `TaskLink`
   with `provider: TODOIST`. Creating a second export is blocked by the unique constraint.
4. **Status does not cascade to threads.** Threads keep their Gmail unread/label state
   independently. Marking a work item DONE does not archive its threads in Gmail.
5. **The UI should filter DONE items by default** but allow the user to show them. DONE items
   are kept indefinitely for reference.
