# Data Model — Email Work Console

## Design Decisions

These decisions are locked before implementation begins:

| Decision | Resolution |
|---|---|
| Gmail write-back in V1 | **Read-only.** The app never writes labels, archives, or modifies Gmail state. |
| Thread ownership | **One thread, one work item.** A thread can be unlinked, but it cannot belong to two work items at once. |
| System of record | **Gmail.** Thread metadata is a mirror; the canonical source is always Gmail. |
| Message body storage | **Not stored.** Only thread-level metadata is mirrored. Full message bodies are fetched on demand via the API. |
| Deleted Gmail threads | Marked `stale` in the local mirror. Work items that reference stale threads are not deleted. |

---

## Entity Overview

| Entity | Purpose |
|---|---|
| **Account** | A connected Gmail or Google Workspace mailbox authenticated via OAuth |
| **ThreadMirror** | Local metadata copy of a Gmail thread; the bridge between Gmail and the app |
| **Domain** | A user-defined responsibility area (e.g. Troop 42, EducatOrr) |
| **WorkItem** | The central unit of work; bundles related threads, notes, status, and task links |
| **TaskLink** | A connection from a work item to an external task system (Todoist, later OpenProject) |
| **Rule** | Logic that suggests or assigns domains and work items based on thread metadata |
| **ActivityLog** | Append-only log of sync events and user actions for trust and debugging |

---

## Entity Definitions

### Account

Represents one connected Gmail or Google Workspace mailbox.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `email` | String | unique, required | Primary identifier for the account |
| `displayName` | String | required | e.g. "Garth — Troop 42" |
| `accessToken` | String | required | Encrypted at rest |
| `refreshToken` | String | required | Encrypted at rest |
| `tokenExpiresAt` | DateTime | required | Used to trigger refresh before sync |
| `isActive` | Boolean | default true | Set false when token is revoked or removed |
| `lastSyncAt` | DateTime? | nullable | Null until first successful sync |
| `createdAt` | DateTime | auto | |
| `updatedAt` | DateTime | auto | |

**Relations:** has many `ThreadMirror`, has many `ActivityLog`

---

### ThreadMirror

A local copy of Gmail thread metadata. Never stores message bodies or attachments.
One ThreadMirror per Gmail thread per account.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `gmailThreadId` | String | required | Gmail's native thread ID |
| `accountId` | UUID | FK → Account | |
| `subject` | String | required | Thread subject line |
| `snippet` | String | required | Latest message preview (~200 chars) |
| `participantAddresses` | String[] | required | All from/to/cc addresses across all messages |
| `gmailLabelIds` | String[] | required | Gmail label IDs (INBOX, UNREAD, SENT, etc.) |
| `messageCount` | Int | required | Total messages in thread |
| `hasAttachments` | Boolean | default false | True if any message has attachments |
| `isUnread` | Boolean | default false | Derived from `gmailLabelIds` containing UNREAD |
| `lastMessageAt` | DateTime | required | Timestamp of most recent message |
| `firstMessageAt` | DateTime | required | Timestamp of original message |
| `historyId` | String | required | Gmail history ID for incremental sync |
| `syncedAt` | DateTime | auto | When this mirror was last updated |
| `isStale` | Boolean | default false | True if thread no longer exists in Gmail |
| `workItemId` | UUID? | FK → WorkItem, nullable | Null = unlinked; set = attached to work item |
| `createdAt` | DateTime | auto | |
| `updatedAt` | DateTime | auto | |

**Unique constraints:**
- `(gmailThreadId, accountId)` — a thread appears once per account

**Indexes:** `accountId`, `workItemId`, `lastMessageAt`, `isUnread`, `isStale`

**Relations:** belongs to `Account`, belongs to optional `WorkItem`

---

### Domain

A user-defined responsibility area. Domains organize work items, not threads directly.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `name` | String | unique, required | e.g. "Troop 42", "EducatOrr" |
| `color` | String | required | Hex color for UI badges, default `#6366f1` |
| `description` | String? | nullable | Optional context |
| `isActive` | Boolean | default true | Soft-delete; inactive domains hidden from UI |
| `sortOrder` | Int | default 0 | Controls sidebar ordering |
| `createdAt` | DateTime | auto | |
| `updatedAt` | DateTime | auto | |

**Initial seed data:**

| Name | Color |
|---|---|
| Troop 42 | `#16a34a` (green) |
| Heart of Dallas District | `#2563eb` (blue) |
| EducatOrr | `#9333ea` (purple) |
| Lake Highlands Church | `#dc2626` (red) |
| SJES | `#ea580c` (orange) |
| Personal | `#64748b` (slate) |

**Relations:** has many `WorkItem`, optionally referenced by `Rule`

---

### WorkItem

The central object. Represents one unit of coordinated, trackable effort. May contain
threads from multiple accounts.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `title` | String | required | Short, human-written label |
| `summary` | String? | nullable | 1–3 sentence description of what this is about |
| `status` | WorkItemStatus | required, default NEW | See status model |
| `domainId` | UUID? | FK → Domain, nullable | Nullable to allow unassigned items during triage |
| `dueDate` | DateTime? | nullable | |
| `notes` | Text? | nullable | Markdown; personal working notes |
| `checklist` | Json? | nullable | Array of `{text: string, done: boolean}` |
| `createdAt` | DateTime | auto | |
| `updatedAt` | DateTime | auto | |

**Indexes:** `domainId`, `status`, `dueDate`

**Relations:** belongs to optional `Domain`, has many `ThreadMirror`, has many `TaskLink`,
has many `ActivityLog`

---

### TaskLink

Records an export of a work item to an external task system. Prevents duplicate exports.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `workItemId` | UUID | FK → WorkItem, required | |
| `provider` | TaskProvider | required | TODOIST or OPENPROJECT |
| `externalId` | String | required | Provider's task/card ID |
| `externalUrl` | String? | nullable | Deep link to task in provider UI |
| `externalTitle` | String? | nullable | Title at time of export (for audit) |
| `externalStatus` | String? | nullable | Last known status from provider (optional sync) |
| `exportedAt` | DateTime | auto | |
| `lastSyncAt` | DateTime? | nullable | Last time status was pulled from provider |
| `createdAt` | DateTime | auto | |

**Unique constraints:**
- `(workItemId, provider)` — one export per provider per work item
- `(provider, externalId)` — prevents importing the same external task twice

**Relations:** belongs to `WorkItem`

---

### Rule

Logic for suggesting or auto-assigning domains and work items based on thread metadata.
Used in Phase 4. Schema is defined in Phase 0 so Phase 1 can store the table without needing
a migration later.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `name` | String | required | Human label, e.g. "Troop 42 — scoutmaster emails" |
| `description` | String? | nullable | |
| `isActive` | Boolean | default true | |
| `priority` | Int | default 100 | Lower number = evaluated first |
| `conditions` | Json | required | Array of `{field, operator, value}` |
| `action` | RuleAction | required | What to do when conditions match |
| `domainId` | UUID? | FK → Domain, nullable | Target domain (for assignment actions) |
| `createdAt` | DateTime | auto | |
| `updatedAt` | DateTime | auto | |

**Condition fields:** `sender`, `recipient`, `account`, `subject`, `label`, `participantCount`

**Operators:** `equals`, `contains`, `startsWith`, `endsWith`, `in`, `notIn`

**Indexes:** `(isActive, priority)`

**Relations:** optionally references `Domain`

---

### ActivityLog

Append-only audit trail of sync events and user actions. Never updated; only inserted.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `eventType` | ActivityEventType | required | Enum value identifying what happened |
| `accountId` | UUID? | FK → Account, nullable | Set null if account is deleted |
| `workItemId` | UUID? | FK → WorkItem, nullable | Set null if work item is deleted |
| `description` | String | required | Human-readable summary of the event |
| `metadata` | Json? | nullable | Structured event-specific data |
| `createdAt` | DateTime | auto | Append-only; no `updatedAt` |

**Indexes:** `createdAt`, `accountId`, `workItemId`, `eventType`

**Relations:** optionally references `Account`, optionally references `WorkItem`

---

## Enums

### WorkItemStatus
```
NEW        Thread noticed; not yet evaluated or assigned
ACTIVE     Being worked on right now
WAITING    Sent a message; awaiting a response
DELEGATED  Handed off to someone else to act on
TODOIST    Exported to Todoist; managed there
DONE       Resolved; archived within the app
```

### TaskProvider
```
TODOIST
OPENPROJECT
```

### RuleAction
```
SUGGEST_DOMAIN       Surface a domain suggestion to the user (no auto-assign)
AUTO_ASSIGN_DOMAIN   Assign domain automatically without user confirmation
SUGGEST_WORK_ITEM    Suggest linking to an existing work item
FLAG_FOR_REVIEW      Mark thread for manual triage
```

### ActivityEventType
```
ACCOUNT_CONNECTED
ACCOUNT_DISCONNECTED
ACCOUNT_SYNC_STARTED
ACCOUNT_SYNC_COMPLETED
ACCOUNT_SYNC_FAILED
THREAD_IMPORTED
THREAD_UPDATED
THREAD_STALE
WORK_ITEM_CREATED
WORK_ITEM_UPDATED
WORK_ITEM_STATUS_CHANGED
THREAD_ATTACHED
THREAD_DETACHED
DOMAIN_ASSIGNED
TASK_EXPORTED
TASK_SYNC_UPDATED
RULE_APPLIED
```

---

## Draft Prisma Schema

This is a design artifact. It will become `prisma/schema.prisma` at the start of Phase 1.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ────────────────────────────────────────────────────────────────────

enum WorkItemStatus {
  NEW
  ACTIVE
  WAITING
  DELEGATED
  TODOIST
  DONE
}

enum TaskProvider {
  TODOIST
  OPENPROJECT
}

enum RuleAction {
  SUGGEST_DOMAIN
  AUTO_ASSIGN_DOMAIN
  SUGGEST_WORK_ITEM
  FLAG_FOR_REVIEW
}

enum ActivityEventType {
  ACCOUNT_CONNECTED
  ACCOUNT_DISCONNECTED
  ACCOUNT_SYNC_STARTED
  ACCOUNT_SYNC_COMPLETED
  ACCOUNT_SYNC_FAILED
  THREAD_IMPORTED
  THREAD_UPDATED
  THREAD_STALE
  WORK_ITEM_CREATED
  WORK_ITEM_UPDATED
  WORK_ITEM_STATUS_CHANGED
  THREAD_ATTACHED
  THREAD_DETACHED
  DOMAIN_ASSIGNED
  TASK_EXPORTED
  TASK_SYNC_UPDATED
  RULE_APPLIED
}

// ─── Models ───────────────────────────────────────────────────────────────────

model Account {
  id              String    @id @default(uuid())
  email           String    @unique
  displayName     String
  accessToken     String    // encrypted at rest
  refreshToken    String    // encrypted at rest
  tokenExpiresAt  DateTime
  isActive        Boolean   @default(true)
  lastSyncAt      DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  threads         ThreadMirror[]
  activityLogs    ActivityLog[]
}

model ThreadMirror {
  id                    String    @id @default(uuid())
  gmailThreadId         String
  accountId             String
  subject               String
  snippet               String    @db.Text
  participantAddresses  String[]
  gmailLabelIds         String[]
  messageCount          Int
  hasAttachments        Boolean   @default(false)
  isUnread              Boolean   @default(false)
  lastMessageAt         DateTime
  firstMessageAt        DateTime
  historyId             String
  syncedAt              DateTime  @default(now())
  isStale               Boolean   @default(false)
  workItemId            String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  account               Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  workItem              WorkItem? @relation(fields: [workItemId], references: [id], onDelete: SetNull)

  @@unique([gmailThreadId, accountId])
  @@index([accountId])
  @@index([workItemId])
  @@index([lastMessageAt])
  @@index([isUnread])
  @@index([isStale])
}

model Domain {
  id          String     @id @default(uuid())
  name        String     @unique
  color       String     @default("#6366f1")
  description String?
  isActive    Boolean    @default(true)
  sortOrder   Int        @default(0)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  workItems   WorkItem[]
  rules       Rule[]
}

model WorkItem {
  id          String          @id @default(uuid())
  title       String
  summary     String?         @db.Text
  status      WorkItemStatus  @default(NEW)
  domainId    String?
  dueDate     DateTime?
  notes       String?         @db.Text
  checklist   Json?           // [{text: string, done: boolean}]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  domain       Domain?        @relation(fields: [domainId], references: [id])
  threads      ThreadMirror[]
  taskLinks    TaskLink[]
  activityLogs ActivityLog[]

  @@index([domainId])
  @@index([status])
  @@index([dueDate])
}

model TaskLink {
  id              String        @id @default(uuid())
  workItemId      String
  provider        TaskProvider
  externalId      String
  externalUrl     String?
  externalTitle   String?
  externalStatus  String?
  exportedAt      DateTime      @default(now())
  lastSyncAt      DateTime?
  createdAt       DateTime      @default(now())

  workItem        WorkItem      @relation(fields: [workItemId], references: [id], onDelete: Cascade)

  @@unique([workItemId, provider])
  @@unique([provider, externalId])
}

model Rule {
  id          String      @id @default(uuid())
  name        String
  description String?
  isActive    Boolean     @default(true)
  priority    Int         @default(100)
  conditions  Json        // [{field, operator, value}]
  action      RuleAction
  domainId    String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  domain      Domain?     @relation(fields: [domainId], references: [id], onDelete: SetNull)

  @@index([isActive, priority])
}

model ActivityLog {
  id          String              @id @default(uuid())
  eventType   ActivityEventType
  accountId   String?
  workItemId  String?
  description String
  metadata    Json?
  createdAt   DateTime            @default(now())

  account     Account?            @relation(fields: [accountId], references: [id], onDelete: SetNull)
  workItem    WorkItem?           @relation(fields: [workItemId], references: [id], onDelete: SetNull)

  @@index([createdAt])
  @@index([accountId])
  @@index([workItemId])
  @@index([eventType])
}
```
