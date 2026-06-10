# Feature Sketches: Work Items, Kanban Views, Bucket Customization

## 1. Work Item View Shows Emails + Todoist Tasks

**Current state:**
- Work item detail view has a "Threads" section showing attached emails
- A separate "Send to Todoist" button creates a new task (one per work item max)
- TaskLink records exist but aren't displayed alongside threads

**Desired state:**
- A unified "Linked content" section showing both emails and Todoist tasks
- Ability to attach emails to an existing Todoist task (not just create new)
- View all linked content in one place with clear visual distinction

### Changes needed:

#### Database
- Add `taskLink` relation to fetch in `/api/work-items/[id]` route
- (No schema change needed — `TaskLink` already exists with `workItemId` foreign key)

#### API (`src/app/api/work-items/[id]/route.ts`)
```
GET response should include:
{
  ...existing fields,
  threads: Thread[],
  taskLinks: TaskLink[]  // new: fetch from DB
}
```

#### UI Component (`src/components/work-items/WorkItemDetail.tsx`)
Replace the separate "Threads" and "Todoist link" sections with:
```
<LinkedContentPanel>
  <LinkedEmails threads={workItem.threads}>
    - Email subject + account
    - Unread badge, message count
    - Quick actions: view, open in Gmail, detach
  </LinkedEmails>
  
  <LinkedTasks taskLinks={workItem.taskLinks}>
    - Todoist task title + status (active/completed)
    - Last synced time
    - Quick actions: open in Todoist, sync status, unlink
  </LinkedTasks>
</LinkedContentPanel>
```

#### New capability: Attach emails to existing Todoist task
Add a modal to search/select existing Todoist tasks and attach selected emails.
- New endpoint: `PATCH /api/work-items/[id]/todoist` to link to existing task + add email URLs
- Or: `POST /api/work-items/[id]/todoist/attach-emails` to append emails to an existing task

**Example flow:**
1. In work item detail, click "Link to Todoist task"
2. Search existing tasks by project/section
3. Select a task
4. Append the email thread URL to the task description via Todoist API

---

## 2. Individual Kanban Views

**Current state:**
- Single global kanban showing all active work items
- Rows = domains (swimlanes)
- Columns = work item status (NEW, ACTIVE, WAITING, etc.)

**Desired state:**
- View kanban for a single domain
- Maybe: view kanban for a single work item's sub-tasks (if we add subtasks in future)
- Quick navigation between domain kanbans

### Changes needed:

#### Routes
- Keep `/kanban` as the global multi-domain view
- Add `/kanban/[domainId]` for single-domain view

#### New page: `src/app/kanban/[domainId]/page.tsx`
```tsx
export default async function DomainKanbanPage({ params: { domainId } }) {
  const [domain, workItems] = await Promise.all([
    prisma.domain.findUniqueOrThrow({ where: { id: domainId } }),
    prisma.workItem.findMany({
      where: { 
        domainId,
        status: { not: "DONE" }
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // If domain has custom kanbanColumns, use them; else defaults
  const columns = domain.kanbanColumns 
    ? JSON.parse(domain.kanbanColumns)
    : DEFAULT_COLUMNS;

  return (
    <AppShell>
      <KanbanHeader domain={domain} />
      <KanbanBoard
        workItems={workItems}
        columns={columns}
        domainId={domainId}
        // No swimlanes — single domain, so rows are either work item categories
        // or (future) sub-task groups
      />
    </AppShell>
  );
}
```

#### UI
- Add a domain selector in the global kanban header
- Navigation: "View kanban" link in domain sidebar → `/kanban/[domainId]`
- Breadcrumb: `Kanban / [Domain Name]`

---

## 3. Customizable Kanban Buckets

**Current state:**
- Columns are hardcoded: `DEFAULT_COLUMNS` in `kanban/page.tsx`
  ```
  NEW, ACTIVE, WAITING, DELEGATED, TODOIST, DONE
  ```
- All domains see the same columns
- `Domain.kanbanColumns` field exists but isn't used

**Desired state:**
- Each domain can customize which statuses appear as columns
- Rename columns (e.g., "Active" → "In Progress")
- Show/hide columns
- Reorder columns
- Apply per-domain (global kanban shows the union or a selector)

### Changes needed:

#### Type definition (already partially in code)
```ts
// src/app/api/domains/[id]/kanban-config/route.ts (already exists)
interface KanbanColumnConfig {
  status: WorkItemStatus;      // enum value: NEW, ACTIVE, etc.
  label: string;                // display name
  visible: boolean;             // show/hide toggle
  order?: number;               // custom ordering
}
```

#### API Endpoints
**GET** `/api/domains/[id]/kanban-config` — read current config
```
Returns: { columns: KanbanColumnConfig[] }
```

**POST** `/api/domains/[id]/kanban-config` — save config
```
Body: { columns: KanbanColumnConfig[] }
Validates that all required statuses are present (or picks smart defaults)
```

#### UI: KanbanConfigDialog
- Modal triggered by "Customize columns" button in kanban header
- Drag-to-reorder list
- Toggle visibility checkboxes
- Editable label fields
- Reset to defaults button
- Apply / Cancel

#### Domain-level kanban view logic
When rendering `/kanban/[domainId]`:
```ts
const columns = domain.kanbanColumns 
  ? (JSON.parse(domain.kanbanColumns) as KanbanColumnConfig[])
  : DEFAULT_COLUMNS;
const visibleColumns = columns.filter(c => c.visible);
```

#### Global kanban view logic
When rendering `/kanban` (multi-domain):
- Option A: Show intersection of all enabled columns (safe, simple)
- Option B: Show union + use domain color coding per column
- Suggested: Option A (intersection) to keep global view clean

---

## Implementation Priority

### Phase 1 (quick wins):
1. **Feature 1a**: Display taskLinks in WorkItemDetail alongside threads
   - Fetch taskLinks in the API
   - Add a "Linked Todoist Tasks" section
   - Show status + last sync time
   - 2–3 PRs

2. **Feature 3**: Kanban column customization
   - Wire up `Domain.kanbanColumns` storage
   - Add the config dialog UI
   - 1–2 PRs

### Phase 2 (medium effort):
3. **Feature 2**: Individual domain kanban views
   - Create `/kanban/[domainId]` route + page
   - Add domain selector dropdown
   - 1 PR

### Phase 3 (future):
4. **Feature 1b**: Attach emails to existing Todoist tasks
   - New endpoint to search/link existing tasks
   - Modal UI for task selection
   - Append email URLs to task description
   - 1–2 PRs

---

## Arch Notes

- All three features use existing data structures (no schema migration needed except possible denormalization for performance)
- The `Domain.kanbanColumns` JSON field already exists and is awaiting implementation
- TaskLink records are already created but not displayed — mostly a UI/fetch improvement
- Individual kanban views just add routing/filtering; no new business logic

