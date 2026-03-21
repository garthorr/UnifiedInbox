# Wireframes — Email Work Console

These are lo-fi ASCII wireframes representing the key screens in the initial build (Phase 1–2).
They define layout intent and key actions. Visual styling (colors, typography, icons) is handled
in implementation using Tailwind + shadcn/ui.

---

## Screen 1: Unified Intake

The primary landing view. Shows thread activity across all connected accounts.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Email Work Console                                [Settings]  [Sync ↻] │
├───────────────┬─────────────────────────────────────────────────────────┤
│  DOMAINS      │  UNIFIED INTAKE                                         │
│               │                                                         │
│  ○ All        │  ┌─────────────────────────────────────────────────────┐│
│  ○ Troop 42   │  │  [All Accounts ▼]  [Unread]  [7 days ▼]  [🔍 ···] ││
│  ○ HoDD       │  └─────────────────────────────────────────────────────┘│
│  ○ EducatOrr  │                                                         │
│  ○ LH Church  │  ┌─────────────────────────────────────────────────────┐│
│  ○ SJES       │  │ ●  [Troop 42]    Spring Banquet Planning  [+ WI]   ││
│  ○ Personal   │  │    john@venue.com · troop42@gmail · 3 msgs · 2h    ││
│  ─────────    │  │    "Can you confirm the venue reservation for..."   ││
│  [+ New]      │  └─────────────────────────────────────────────────────┘│
│               │  ┌─────────────────────────────────────────────────────┐│
│  WORK ITEMS   │  │ ○  [—Unassigned—]  RE: Budget Approval    [+ WI]   ││
│  Active:   5  │  │    finance@org · me@work · 1 msg · 5h ago          ││
│  Waiting:  3  │  │    "Please review the attached Q2 budget..."        ││
│  Delegated:1  │  └─────────────────────────────────────────────────────┘│
│               │  ┌─────────────────────────────────────────────────────┐│
│               │  │ ●  [EducatOrr]   Parent Meeting Follow-up  [WI →]  ││
│               │  │    parent@mail · admin@edu · 8 msgs · 1d ago       ││
│               │  │    "Thank you for the meeting. A few items we..."   ││
│               │  └─────────────────────────────────────────────────────┘│
│               │  ┌─────────────────────────────────────────────────────┐│
│               │  │ ○  [Troop 42]    Permission Slips Due       [+ WI]  ││
│               │  │    scoutmaster@troop42 · 1 msg · 3h ago            ││
│               │  │    "Reminder: permission slips are due by..."       ││
│               │  └─────────────────────────────────────────────────────┘│
│               │  [Load more...]                                         │
└───────────────┴─────────────────────────────────────────────────────────┘

KEY
●  = unread thread
○  = read thread
[+ WI]  = create new work item from this thread
[WI →]  = open existing work item this thread is attached to
Domain badge = assigned (colored) or Unassigned (gray)
```

**Key actions available:**
- Filter by account, unread state, date range
- Click thread row → thread detail / open in Gmail
- `[+ WI]` → create work item modal, pre-filled with thread
- `[WI →]` → jump to the work item this thread is already attached to
- Click domain in sidebar → switches to Domain Pile View
- `[Sync ↻]` → trigger manual sync for all accounts

---

## Screen 2: Domain Pile View

Focused view of work items and unlinked threads for one domain. The "pile" to process.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    TROOP 42                                  [+ New Work Item]  │
├───────────────┬─────────────────────────────────────────────────────────┤
│  FILTER       │  ACTIVE  (2)                                            │
│               │  ┌─────────────────────────────────────────────────────┐│
│  Active   (2) │  │  Spring Banquet 2026                  [ACTIVE]  [→] ││
│  Waiting  (2) │  │  2 threads attached · Due Apr 15 · Updated 2h ago  ││
│  Delegated(0) │  └─────────────────────────────────────────────────────┘│
│  Todoist  (1) │  ┌─────────────────────────────────────────────────────┐│
│  Done    (12) │  │  Merit Badge Night Planning            [ACTIVE]  [→] ││
│               │  │  1 thread attached · No due date · Updated 3d ago  ││
│  ─────────    │  └─────────────────────────────────────────────────────┘│
│  Show Done    │                                                         │
│               │  WAITING  (2)                                           │
│               │  ┌─────────────────────────────────────────────────────┐│
│               │  │  Eagle Scout Board — James T.          [WAIT]   [→] ││
│               │  │  1 thread attached · Waiting since Mar 18          ││
│               │  └─────────────────────────────────────────────────────┘│
│               │  ┌─────────────────────────────────────────────────────┐│
│               │  │  Recharter Paperwork 2026              [WAIT]   [→] ││
│               │  │  2 threads attached · Waiting since Mar 12         ││
│               │  └─────────────────────────────────────────────────────┘│
│               │                                                         │
│               │  UNLINKED THREADS  (3 new since last visit)            │
│               │  ┌─────────────────────────────────────────────────────┐│
│               │  │ ●  Campout Permission Slips   [Link to WI] [+ New] ││
│               │  │    scoutmaster@troop42 · 2h ago · 1 msg            ││
│               │  └─────────────────────────────────────────────────────┘│
│               │  ┌─────────────────────────────────────────────────────┐│
│               │  │ ●  Summer Camp Deposit         [Link to WI] [+ New] ││
│               │  │    campregistrar@bsa · 4h ago · 2 msgs             ││
│               │  └─────────────────────────────────────────────────────┘│
│               │  ┌─────────────────────────────────────────────────────┐│
│               │  │ ○  FW: District Newsletter     [Link to WI] [+ New] ││
│               │  │    district@hod · 1d ago · 1 msg                   ││
│               │  └─────────────────────────────────────────────────────┘│
└───────────────┴─────────────────────────────────────────────────────────┘

KEY
[→]          = open work item detail
[Link to WI] = attach this thread to an existing work item
[+ New]      = create a new work item from this thread
Sections:    Work items grouped by status, then unlinked threads below
```

**Notes:**
- The unlinked threads section shows only threads whose assigned domain is Troop 42 but which
  have no `workItemId`. This is the triage queue for this domain.
- "New since last visit" badge helps the user see what arrived since they last processed this pile.
- "Show Done" toggle reveals completed work items at the bottom.

---

## Screen 3: Work Item Detail

Full detail view for one work item. Dual-panel layout: left = content, right = threads.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Troop 42     Spring Banquet 2026                      [Edit]  [···] │
├─────────────────────────────────────────────────────────────────────────┤
│  Status: [ACTIVE ▼]     Domain: [Troop 42 ▼]     Due: [Apr 15, 2026 ▼]│
├──────────────────────────┬──────────────────────────────────────────────┤
│  SUMMARY                 │  THREADS  (2)                                │
│                          │                                              │
│  Coordinate venue,       │  ┌────────────────────────────────────────┐ │
│  catering, and comms     │  │ [troop42@gmail.com]                     │ │
│  for Spring Banquet      │  │ Venue Confirmation                     │ │
│  on April 15, 2026.      │  │ john@venue.com · 3 msgs · Unread       │ │
│                          │  │ [Open in Gmail ↗]          [Detach ×] │ │
│  [Edit summary]          │  └────────────────────────────────────────┘ │
│                          │                                              │
│  NOTES                   │  ┌────────────────────────────────────────┐ │
│  ┌──────────────────────┐│  │ [personal@gmail.com]                   │ │
│  │ Venue confirmed for  ││  │ Catering Quote                         │ │
│  │ April 15. Need to    ││  │ events@catering.co · 1 msg · Read     │ │
│  │ follow up on menu    ││  │ [Open in Gmail ↗]          [Detach ×] │ │
│  │ options by March 25. ││  └────────────────────────────────────────┘ │
│  └──────────────────────┘│                                              │
│  [Edit]                  │  [+ Attach a Thread]                         │
│                          │                                              │
│  CHECKLIST               │  TASK LINKS                                  │
│  ☑  Book venue           │  No external tasks yet.                      │
│  ☐  Confirm catering     │                                              │
│  ☐  Send invitations     │  [Export to Todoist →]                       │
│  ☐  Collect RSVPs        │                                              │
│  [+ Add item]            │  ACTIVITY LOG                                │
│                          │  ↳ Thread attached (troop42) · 2h ago       │
│                          │  ↳ Thread attached (personal) · 3h ago      │
│                          │  ↳ Status → ACTIVE · 1d ago                 │
│                          │  ↳ Work item created · 1d ago               │
│                          │  [Show all...]                               │
└──────────────────────────┴──────────────────────────────────────────────┘

KEY
[Open in Gmail ↗]  = deep link to thread in Gmail (opens new tab)
[Detach ×]         = remove thread from this work item (thread becomes unlinked)
[+ Attach a Thread] = search/select an existing thread to link here
[Export to Todoist →] = opens export dialog with title, notes, domain project pre-filled
```

**Notes:**
- Each thread card shows which account it came from to make cross-account linking visible.
- The `[···]` menu contains: Delete work item, Change domain, Export to Todoist.
- The activity log is read-only and chronological (newest first, truncated with "Show all" link).

---

## Screen 4: Settings — Accounts

Account management and sync configuration.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    SETTINGS                                                     │
├───────────────┬─────────────────────────────────────────────────────────┤
│  Accounts     │  CONNECTED ACCOUNTS                                     │
│  Domains      │                                                         │
│  Rules        │  ┌─────────────────────────────────────────────────────┐│
│  Todoist      │  │ ✓  troop42@gmail.com                                ││
│  Advanced     │  │    Display name:  Garth — Troop 42      [Edit]     ││
│               │  │    Threads synced: 1,243                            ││
│               │  │    Last sync:  Mar 20, 2026 at 8:15 PM             ││
│               │  │    Status:  Active                                  ││
│               │  │    [Sync Now]                    [Remove Account]  ││
│               │  └─────────────────────────────────────────────────────┘│
│               │  ┌─────────────────────────────────────────────────────┐│
│               │  │ ✓  garth@educatorr.com                              ││
│               │  │    Display name:  Garth — EducatOrr     [Edit]     ││
│               │  │    Threads synced: 892                              ││
│               │  │    Last sync:  Mar 20, 2026 at 8:00 PM             ││
│               │  │    Status:  Active                                  ││
│               │  │    [Sync Now]                    [Remove Account]  ││
│               │  └─────────────────────────────────────────────────────┘│
│               │                                                         │
│               │  [+ Connect Google Account]                             │
│               │                                                         │
│               │  SYNC SETTINGS                                          │
│               │  Sync frequency:     [Every 15 minutes ▼]              │
│               │  Initial sync window: [Last 90 days ▼]                 │
│               │  Max threads/account: [500 ▼]                          │
│               │                                  [Save Settings]        │
└───────────────┴─────────────────────────────────────────────────────────┘

NOTES
- "Remove Account" prompts confirmation and warns that threads/work items are preserved
  but syncing will stop and ThreadMirrors will become static.
- "Connect Google Account" launches the Google OAuth flow.
- Sync settings apply to all accounts globally in V1.
```

---

## Screen 5: Sync Log

Visible record of all sync events for trust and debugging.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    SYNC LOG                                       [Clear Log]  │
├─────────────────────────────────────────────────────────────────────────┤
│  [All Accounts ▼]    [All Events ▼]    [Last 24h ▼]                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  8:15 PM  ✓  troop42@gmail      Sync complete  +3 threads  0 errors   │
│  8:00 PM  ✓  garth@educatorr    Sync complete  +1 thread   0 errors   │
│  7:45 PM  ✓  troop42@gmail      Sync complete  +0 threads  0 errors   │
│  7:30 PM  ✗  garth@educatorr    Token expired — attempting refresh     │
│  7:30 PM  ✓  garth@educatorr    Token refresh succeeded               │
│  7:30 PM  ✓  garth@educatorr    Sync complete  +2 threads  0 errors   │
│  6:00 PM  ✓  troop42@gmail      Sync complete  +5 threads  0 errors   │
│  2:00 PM  ✓  troop42@gmail      Initial sync complete  1,243 threads  │
│  1:55 PM  ℹ  troop42@gmail      Initial sync started                  │
│  1:50 PM  ✓  garth@educatorr    Initial sync complete  892 threads    │
│  1:48 PM  ℹ  garth@educatorr    Initial sync started                  │
│  1:47 PM  ✓  garth@educatorr    Account connected                     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  [Load older entries...]                                                 │
└─────────────────────────────────────────────────────────────────────────┘

ICONS
✓  = success
✗  = error
ℹ  = informational / in-progress

NOTES
- Log entries map 1:1 to ActivityLog rows with account-related eventTypes.
- Error rows are expandable to show error message and stack trace in Phase 2.
- "Clear Log" prompts confirmation. Deletes ActivityLog rows older than 7 days.
  Work-item-related activity (thread attached, status changed) is NOT cleared.
```

---

## Navigation Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Unified Intake (default)                  │
│                           │                                  │
│           ┌───────────────┼───────────────┐                 │
│           ▼               ▼               ▼                 │
│     Domain Pile      Work Item       Thread opens           │
│       View           Detail          in Gmail               │
│           │               │                                  │
│           └───────────────┘                                  │
│                     │                                        │
│         ┌───────────┴───────────┐                           │
│         ▼                       ▼                           │
│     Settings               Sync Log                         │
│   (Accounts, Domains,                                        │
│    Rules, Todoist)                                           │
└─────────────────────────────────────────────────────────────┘
```

- The domain sidebar is persistent on Unified Intake and Domain Pile views.
- Settings and Sync Log are modal or separate pages accessible from the top bar.
- Work Item Detail slides in or replaces the right panel on wider viewports.
- Thread interaction always opens Gmail in a new tab (read-only app principle).
