# UnifiedInbox — Email Work Console

A private, self-hosted email dashboard that consolidates multiple Gmail and IMAP accounts into a
single work console, organizing threads into work items grouped by responsibility area.

---

## What This Is

A private self-hosted web app that sits on top of your email accounts and converts email threads
into organized work items — without changing how senders interact with you. Email remains the
system of record. The app adds a coordination layer on top.

In one sentence: **a cross-account work console that turns email threads into work items,
organized by domain, with Kanban or list views and optional Todoist export.**

Everything runs on your own hardware. No email content is sent to any third party.
OAuth tokens and passwords are encrypted at rest. The app is only reachable on your local network.

---

## Features

- **Unified inbox** — multiple Gmail and IMAP accounts in one view, filterable by account, unread status, and date range
- **Domains** — define responsibility areas (projects, roles, organizations) and assign threads to them automatically or manually
- **Work items** — convert one or more threads into a tracked item with title, status, notes (Markdown), checklist, and due date
- **Kanban board view** — per-domain board with configurable columns: toggle visibility, rename labels, reorder; drag cards between columns to update status
- **List view** — traditional grouped-by-status list, available alongside the board view
- **Todoist integration** — export work items to Todoist as tasks; completion syncs back automatically
- **IMAP support** — connect any IMAP/SMTP mailbox in addition to Gmail OAuth accounts
- **Activity log** — full audit trail of sync events and item changes
- **Background sync** — cron worker keeps threads current and syncs external task state

---

## Domains

Domains are the responsibility areas you want to track — a volunteer organization, a side project,
a family, or a work role. You define them to match your own life. The seed data includes examples;
edit or replace them from the Settings page after first run.

---

## Quick Start (Docker)

### Prerequisites

- Docker + Docker Compose
- A Google Cloud project with Gmail API enabled and OAuth 2.0 credentials (for Gmail accounts)
- Any IMAP/SMTP credentials (for non-Gmail accounts)

### 1. Clone and configure

```bash
git clone <repo-url> && cd UnifiedInbox
cp .env.example .env
```

Edit `.env`:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://inbox.yourhostname.com:3000/api/auth/callback
ENCRYPTION_KEY=$(openssl rand -hex 32)
APP_SECRET=any_strong_password
APP_URL=http://inbox.yourhostname.com:3000

# Optional — Todoist integration
TODOIST_API_KEY=
TODOIST_PROJECT_ID=
```

> **Google OAuth does not accept bare IP addresses** as redirect URIs. Use a real hostname —
> it can safely resolve to a private/LAN IP and the app will not be reachable from the internet.
>
> **Option A — subdomain you already own (recommended):**
> Add a DNS `A` record pointing a subdomain to your server's private IP:
> ```
> inbox.yourhostname.com  →  192.168.1.x
> ```
>
> **Option B — local `/etc/hosts` alias (no DNS required):**
> Add this line to `/etc/hosts` on every machine that will access the app:
> ```
> 192.168.1.x  inbox.local
> ```
> Then use `http://inbox.local:3000` for both `APP_URL` and `GOOGLE_REDIRECT_URI`.
> Also add `http://inbox.local:3000/api/auth/callback` as an authorized redirect URI in the
> Google Cloud Console.

### 2. Build and run

```bash
docker compose build
docker compose up
```

The web container automatically runs `prisma migrate deploy` and seeds the database on first start.
Visit `http://<your-host>:3000`.

### 3. Connect accounts

1. Log in with your `APP_SECRET`
2. Go to **Settings → Accounts**
3. Click **Connect Gmail** to add a Gmail account via OAuth, or **Add IMAP Account** to connect
   any IMAP/SMTP mailbox
4. The background worker syncs threads automatically every 15 minutes

---

## Todoist Integration

Set `TODOIST_API_KEY` in `.env` (Settings → Integrations → Developer in Todoist). Once enabled:

- Open any work item and click **Export to Todoist**
- Choose a project and optional section; a task is created in Todoist
- When you complete the task in Todoist, the work item status updates to **Done** automatically

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 + Tailwind CSS + shadcn/ui |
| Backend | Next.js API routes |
| Database | PostgreSQL 16 + Prisma |
| Gmail auth | Google OAuth 2.0 (Gmail API) |
| IMAP/SMTP | ImapFlow + Nodemailer |
| Drag and drop | dnd-kit |
| Background jobs | Node.js worker (ts-node + node-cron) |
| Token encryption | AES-256-GCM |
| Hosting | Self-hosted Docker Compose |

---

## Project Structure

```
src/
  app/
    api/
      accounts/         # Account management (Gmail OAuth + IMAP setup)
      activity-log/     # Audit log endpoints
      auth/             # Google OAuth callback
      domains/          # Domain CRUD + Kanban column config
      threads/          # Thread listing, linking, reply
      todoist/          # Todoist project/section lookup
      work-items/       # Work item CRUD + Todoist export
    domains/            # Domain detail page (list + Kanban views)
    login/              # Login page
    settings/           # Settings page
    sync-log/           # Sync activity log page
    work-items/         # Work item detail page
  components/
    domains/            # DomainThreadsClient, DomainViewToggle, KanbanConfigDialog
    inbox/              # InboxPane, ThreadCard, ThreadList, InboxFilters
    layout/             # AppShell, DomainSidebar
    shared/             # StatusBadge, DomainBadge
    work-items/         # WorkItemCard, WorkItemDetail, KanbanBoard, KanbanColumn, KanbanCard
    ui/                 # shadcn/ui primitives
  lib/
    auth.ts             # Session/password auth
    db.ts               # Prisma client singleton
    encrypt.ts          # Token encryption (AES-256-GCM)
    todoist.ts          # Todoist API client
    utils.ts            # Shared utilities
    gmail/
      client.ts         # Gmail API client (OAuth + auto-refresh)
      oauth.ts          # OAuth flow helpers
      sync.ts           # Thread sync logic (initial + incremental)
      actions.ts        # Archive, trash, mark read, send reply
    imap/
      sync.ts           # IMAP thread sync
      actions.ts        # IMAP archive, trash, mark read, send reply
worker/
  index.ts              # Background sync worker (cron)
prisma/
  schema.prisma         # Database schema
  seed.ts               # Domain seed data
docs/                   # Phase 0 design documents
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Gmail only | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Gmail only | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Gmail only | OAuth callback URL (must match Google Console) |
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for token encryption (`openssl rand -hex 32`) |
| `APP_SECRET` | Yes | Password to access the app |
| `APP_URL` | Yes | Base URL of the app (used in OAuth redirects) |
| `TODOIST_API_KEY` | Optional | Todoist API token (enables Todoist export) |
| `TODOIST_PROJECT_ID` | Optional | Default Todoist project for exported tasks |

---

## Roadmap

| Phase | Goal | Status |
|---|---|---|
| 0 | Definition and design | **Complete** |
| 1 | MVP: OAuth, Gmail sync, unified inbox, domains, work items | **Complete** |
| 2 | Daily usability: notes, search, activity log, IMAP support | **Complete** |
| 3 | Todoist integration with bidirectional sync | **Complete** |
| 4 | Kanban board view with configurable columns per domain | **Complete** |
| 5 | Rules engine and auto-suggestions | Pending |
| 6 | Local AI assistance | Pending |
| 7 | Additional integrations (Zoho Projects, OpenProject, calendar) | Pending |

---

## Phase 0 Design Documents

| Document | Description |
|---|---|
| [Product Spec](docs/product-spec.md) | Problem, outcome, principles, non-goals |
| [Data Model](docs/data-model.md) | Entity definitions + Prisma schema |
| [Status Model](docs/status-model.md) | Work item lifecycle, transitions, colors |
| [Gmail Metadata](docs/gmail-metadata.md) | What is mirrored vs. read-only; sync strategy |
| [Work Item Rules](docs/work-item-rules.md) | When email becomes a work item; domain assignment |
| [Wireframes](docs/wireframes.md) | ASCII wireframes for key screens |
| [Edge Cases](docs/edge-cases.md) | Edge cases with resolution |
