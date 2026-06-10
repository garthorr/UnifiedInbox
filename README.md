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

- **Unified inbox** — multiple Gmail and IMAP accounts in one view, filterable by account, unread status, sender, label, attachments, and date range
- **Today view** — daily triage page surfacing recent unread threads alongside active work items
- **Domains** — define responsibility areas (projects, roles, organizations) and assign threads to them automatically or manually
- **Work items** — convert one or more threads into a tracked item with title, status, notes (Markdown), checklist, and due date
- **Kanban board view** — per-domain board *and* a global cross-domain board with configurable columns: toggle visibility, rename labels, reorder; drag cards between columns to update status
- **List view** — traditional grouped-by-status list, available alongside the board view
- **Bulk actions** — multi-select threads to assign to a domain, attach to an existing work item, snooze, create a new work item, or delete in bulk
- **Snooze** — hide a thread until a chosen time; review what's snoozed on the dedicated Snoozed page
- **Keyboard-first** — j/k navigation, e/#/s/u/r/c/x action keys, g-prefix navigation (g i/t/k/z/s/l), `/` focuses search, `?` opens a help dialog
- **Undo for destructive actions** — archive and delete delay the server call for 4 seconds and surface an Undo toast
- **In-app compose & reply** — send new emails and replies from any connected account without leaving the app
- **Rules engine** — define conditions on subject/sender/snippet/labels/attachments to auto-suggest domains, auto-assign domains, suggest work items, or flag threads for review
- **Local AI assistance** *(optional, via Ollama)* — draft replies, summarize threads, and suggest work-item titles from email content; runs entirely on your hardware
- **Push notifications & PWA** *(optional, via VAPID)* — installable as an app on desktop/phone; get Web Push alerts for new mail and task reminders, with per-type toggles and quiet hours
- **Task reminders** — set a reminder time on any work item and get a push notification when it's due
- **Todoist integration** — export work items to Todoist as tasks; completion syncs back automatically
- **IMAP support** — connect any IMAP/SMTP mailbox in addition to Gmail OAuth accounts
- **Activity log** — full audit trail of sync events and item changes
- **Background sync** — cron worker keeps threads current and syncs external task state
- **Real-time updates** — IMAP accounts use IDLE to sync the instant mail arrives; Gmail accounts are polled on a tight cadence (default 2 min, since Gmail push needs a public webhook and this app is LAN-only); the open UI refreshes itself live via Server-Sent Events (no manual "Sync All")

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

## Local AI (optional)

AI features run against a local [Ollama](https://ollama.com) instance — no email content
ever leaves your network. Without `OLLAMA_BASE_URL` set, the AI endpoints return 503 and
the rest of the app works normally.

```bash
# Install ollama, then pull a model
ollama pull llama3.2
```

Then set in `.env`:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.2
```

Once configured, the email viewer exposes:

- **Draft reply** — generate a draft response to the open thread, optionally with an instruction
- **Summarize** — condense long threads to the essentials
- **Suggest work item** — propose a title and due date from the email content

---

## Todoist Integration

Set `TODOIST_API_KEY` in `.env` (Settings → Integrations → Developer in Todoist). Once enabled:

- Open any work item and click **Export to Todoist**
- Choose a project and optional section; a task is created in Todoist
- When you complete the task in Todoist, the work item status updates to **Done** automatically

---

## Notifications (optional)

Web Push delivers new-mail alerts and task reminders to your desktop and phone, and makes the
app installable as a PWA. Notifications are disabled until you generate a VAPID key pair:

```bash
npx web-push generate-vapid-keys
```

Set the pair in `.env` (the **same** pair must be available to both the web app and the worker):

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

Then open **Settings → Notifications**, click **Enable**, and grant permission. Use **Test** to
confirm delivery. Per-type toggles (new mail / reminders) and quiet hours live in the same panel.
Set a reminder time on any work item (next to its due date) to get a push when it's due.

> Push requires a secure context. Browsers treat `http://localhost` as secure, but other hosts
> need HTTPS for the service worker and Push API to work.

---

## Backups

The Postgres volume (`./data/postgres`) is the only copy of your domains, work items, notes,
and rules — losing it means losing everything that isn't recoverable from your mailboxes.
Back it up with `pg_dump` from the host:

```bash
# One-off backup
docker compose exec -T db pg_dump -U "$POSTGRES_USER" unified_inbox | gzip > unified_inbox_$(date +%F).sql.gz
```

Recommended: a nightly cron job on the host with two weeks of retention:

```cron
0 2 * * * cd /path/to/UnifiedInbox && mkdir -p backups && docker compose exec -T db pg_dump -U "$(grep ^POSTGRES_USER .env | cut -d= -f2)" unified_inbox | gzip > backups/unified_inbox_$(date +\%F).sql.gz && find backups -name '*.sql.gz' -mtime +14 -delete
```

Restore into a fresh database:

```bash
docker compose up -d db
gunzip -c backups/unified_inbox_YYYY-MM-DD.sql.gz | docker compose exec -T db psql -U "$POSTGRES_USER" unified_inbox
docker compose up -d
```

> Dumps contain your **encrypted** OAuth/IMAP credentials (AES-256-GCM, keyed by
> `ENCRYPTION_KEY`) and all email metadata the app mirrors. Store them somewhere private,
> and keep a copy of your `.env` — without `ENCRYPTION_KEY`, restored account credentials
> are unrecoverable and accounts must be reconnected.

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
| Local AI (optional) | Ollama (default model: llama3.2) |
| Hosting | Self-hosted Docker Compose |

---

## Project Structure

```
src/
  app/
    api/
      accounts/         # Account management (Gmail OAuth + IMAP setup)
      activity-log/     # Audit log endpoints
      ai/               # Ollama-backed draft-reply, summarize, suggest-task
      auth/             # Google OAuth callback
      domains/          # Domain CRUD + Kanban column config
      emails/send/      # Compose / send email
      health/           # Liveness endpoint
      rules/            # Rules engine CRUD
      threads/          # Thread listing, linking, reply, bulk actions
      todoist/          # Todoist project/section lookup
      work-items/       # Work item CRUD + Todoist export + bulk assign
    domains/            # Domain detail page (list + Kanban views)
    kanban/             # Global cross-domain Kanban board
    login/              # Login page
    settings/           # Settings page (accounts, rules)
    snoozed/            # Snoozed threads
    sync-log/           # Sync activity log page
    today/              # Today triage view
    work-items/         # Work item detail page
  components/
    domains/            # DomainThreadsClient, DomainViewToggle, KanbanConfigDialog
    inbox/              # InboxPane, ThreadCard, ThreadList, ThreadDrawer, InboxFilters,
                        # ComposeEmail, ReplyCompose, EmailViewer, AiTaskBar,
                        # BulkActionBar, SyncAllButton, InboxSkeleton
    layout/             # AppShell, DomainSidebar
    settings/           # RulesPanel
    shared/             # StatusBadge, DomainBadge
    work-items/         # WorkItemCard, WorkItemDetail, NotesEditor,
                        # CreateWorkItemModal, AttachThreadModal, BulkAssignWorkItemModal,
                        # KanbanBoard, KanbanColumn, KanbanCard
    ui/                 # shadcn/ui primitives
  lib/
    ai.ts               # Shared Ollama client (generate + JSON parsing)
    auth.ts             # Session/password auth
    client-message-cache.ts  # Browser-side message body cache
    db.ts               # Prisma client singleton
    encrypt.ts          # Token encryption (AES-256-GCM)
    env.ts              # Env var helpers
    params.ts           # Query-param parsing helpers
    rules.ts            # Rules engine matcher
    server-message-cache.ts  # Server-side message body cache
    sync-queue.ts       # In-process sync queue
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
  migrations/           # Prisma-managed migrations
  migrations_manual/    # Hand-written SQL migrations
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
| `OLLAMA_BASE_URL` | Optional | Base URL of a local Ollama server (enables AI features) |
| `OLLAMA_MODEL` | Optional | Ollama model name (default `llama3.2`) |
| `SYNC_LOG_THREADS` | Optional | Set to `true` to log every synced thread to the activity log (high-volume; off by default) |
| `VAPID_PUBLIC_KEY` | Optional | Web Push public key (`npx web-push generate-vapid-keys`); enables notifications |
| `VAPID_PRIVATE_KEY` | Optional | Web Push private key (must match the public key; shared by web app + worker) |
| `VAPID_SUBJECT` | Optional | Contact `mailto:`/`https:` URL for push services (defaults to `APP_URL`) |
| `SYNC_INTERVAL_MINUTES` | Optional | Full sync sweep cadence in minutes (default `15`) |
| `GMAIL_SYNC_INTERVAL_MINUTES` | Optional | Gmail-only poll cadence in minutes (default `2`); IMAP uses IDLE instead |

---

## Roadmap

| Phase | Goal | Status |
|---|---|---|
| 0 | Definition and design | **Complete** |
| 1 | MVP: OAuth, Gmail sync, unified inbox, domains, work items | **Complete** |
| 2 | Daily usability: notes, search, activity log, IMAP support | **Complete** |
| 3 | Todoist integration with bidirectional sync | **Complete** |
| 4 | Kanban board view with configurable columns per domain | **Complete** |
| 5 | Rules engine and auto-suggestions | **Complete** |
| 6 | Local AI assistance (Ollama) | **Complete** |
| 7 | Bulk multi-select, in-app compose, global Kanban, Today view | **Complete** |
| 8 | Additional integrations (Zoho Projects, OpenProject, calendar) | Pending |
| 9 | Push notifications + PWA: new-mail alerts, task reminders, installable app | **In progress** |
| 9 | Real-time: IMAP IDLE + live UI updates (SSE) so the inbox refreshes itself | **In progress** |
| 9+ | Real-time Gmail via Pub/Sub push (needs a public webhook — see notes) | Pending |

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
