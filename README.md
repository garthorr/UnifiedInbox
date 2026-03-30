# UnifiedInbox — Email Work Console

A private, self-hosted Gmail dashboard that consolidates multiple accounts into a single
work console, organizing threads into work items grouped by responsibility area.

> **Status:** Phase 1–3 complete. OAuth, Gmail sync, unified inbox, domains, work items, label filtering, account color coding, and Todoist integration are operational.

---

## What This Is

A private self-hosted web app that sits on top of multiple Gmail accounts and converts email into
organized work items without changing how senders interact with you. Gmail remains the system of
record. The app adds a coordination layer on top.

In one sentence: **a cross-account work console that groups related threads into work items
organized by responsibility area.**

Everything runs on your own hardware. No email content is sent to any third party.
OAuth tokens are encrypted at rest. The app is only reachable on your local network.

---

## Domains

Domains are the responsibility areas you want to track — for example, a volunteer organization,
a side project, a family, or a work role. You define them to match your own life. The seed
data includes examples; edit or replace them from the Settings page after first run.

---

## Quick Start (Docker)

### Prerequisites

- Docker + Docker Compose
- A Google Cloud project with Gmail API enabled and OAuth 2.0 credentials

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

# Optional: Todoist integration
TODOIST_API_KEY=your_todoist_api_token
TODOIST_PROJECT_ID=          # leave blank to send to Todoist inbox
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
> Also add `http://inbox.local:3000/api/auth/callback` as an authorized redirect URI in Google
> Cloud Console.

### 2. Build and run

```bash
docker compose build
docker compose up
```

The web container automatically runs `prisma migrate deploy` and seeds the database on first start.
Visit `http://<your-host>:3000`.

> **Running migrations manually** — if you need to run migrations interactively (e.g. `migrate dev`),
> always do so inside the container to use the correct Prisma version:
> ```bash
> docker compose exec web npx prisma migrate dev --name my_migration
> ```

### 3. Connect Gmail accounts

1. Log in with your `APP_SECRET`
2. Go to **Settings → Accounts**
3. Click **Connect Gmail** and complete OAuth for each account
4. The background worker syncs threads automatically

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 + Tailwind CSS + shadcn/ui |
| Backend | Next.js API routes |
| Database | PostgreSQL 16 + Prisma |
| Auth | Google OAuth 2.0 (Gmail API) |
| Background jobs | Node.js worker (ts-node) |
| Hosting | Self-hosted Docker Compose |
| AI | Local Ollama endpoint (Phase 5) |

---

## Project Structure

```
src/
  app/
    api/
      accounts/       # Gmail account management
      activity-log/   # Audit log endpoints
      auth/           # Google OAuth callback
      domains/        # Domain CRUD
      threads/        # Thread listing and linking
      work-items/     # Work item CRUD
    domains/          # Domains page
    login/            # Login page
    settings/         # Settings page
    sync-log/         # Sync activity log page
    work-items/       # Work items page
  lib/
    auth.ts           # Session/password auth
    db.ts             # Prisma client singleton
    encrypt.ts        # Token encryption (AES-256)
    utils.ts          # Shared utilities
    gmail/
      client.ts       # Gmail API client
      oauth.ts        # OAuth flow helpers
      sync.ts         # Thread sync logic
worker/
  index.ts            # Background sync worker (cron)
prisma/
  schema.prisma       # Database schema
  seed.ts             # Domain seed data
docs/                 # Phase 0 design documents
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Yes | OAuth callback URL (must match Google Console) |
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for token encryption (`openssl rand -hex 32`) |
| `APP_SECRET` | Yes | Password to access the app |
| `APP_URL` | Yes | Base URL of the app (used in OAuth redirects) |
| `TODOIST_API_KEY` | No | Todoist API token — enables "Export to Todoist" on work items |
| `TODOIST_PROJECT_ID` | No | Target Todoist project ID; omit to send to inbox |

---

## Features

- **Unified inbox** — all Gmail accounts in a single view, sorted by recency
- **Label filtering** — filter by Gmail labels or show Inbox-only with one click
- **Account color coding** — each connected account gets a color shown as a left-border stripe on threads; customizable in Settings
- **Work items** — group related threads from multiple accounts into a named work item with status, notes, checklist, and due date
- **Domains** — organize work items by responsibility area (e.g. a volunteer role, project, or team)
- **Todoist export** — push a work item to Todoist with thread links attached; marks work item DONE when Todoist task is completed
- **Background sync** — worker syncs all accounts every 15 minutes via Gmail incremental history API
- **Activity log** — full audit trail of sync events, status changes, and thread attachments
- **Single-user auth** — password-protected, session cookie, no external auth service needed

---

## Roadmap

| Phase | Goal | Status |
|---|---|---|
| 0 | Definition and design | **Complete** |
| 1 | MVP: OAuth, sync, unified inbox, domains, work items | **Complete** |
| 2 | Daily usability: search, activity log, label filtering, account colors | **Complete** |
| 3 | Todoist integration | **Complete** |
| 4 | Rules engine and auto-suggestions | Pending |
| 5 | Local AI (Ollama) assistance | Pending |
| 6 | Mature console: OpenProject, calendar, mobile | Pending |

---

## Phase 0 Design Documents

| Document | Description |
|---|---|
| [Product Spec](docs/product-spec.md) | Problem, outcome, principles, non-goals |
| [Data Model](docs/data-model.md) | 7 entity definitions + draft Prisma schema |
| [Status Model](docs/status-model.md) | Work item lifecycle, transitions, colors |
| [Gmail Metadata](docs/gmail-metadata.md) | What is mirrored vs. read-only; sync strategy |
| [Work Item Rules](docs/work-item-rules.md) | When email becomes a work item; domain assignment |
| [Wireframes](docs/wireframes.md) | ASCII wireframes for 5 key screens |
| [Edge Cases](docs/edge-cases.md) | 12 edge cases with resolution |
