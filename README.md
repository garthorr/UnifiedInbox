# UnifiedInbox — Email Work Console

A personal Gmail-connected operations dashboard that turns email from multiple accounts into
organized work items grouped by life, business, and volunteer domains.

> **Status:** Phase 1 complete — MVP running. OAuth, Gmail sync, unified inbox, domains, and work items are operational.

---

## What This Is

A private self-hosted web app that sits on top of multiple Gmail accounts and converts email into
organized work items without changing how senders interact with you. Gmail remains the system of
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
GOOGLE_REDIRECT_URI=http://<your-host>:3000/api/auth/callback
ENCRYPTION_KEY=$(openssl rand -hex 32)
APP_SECRET=any_strong_password
APP_URL=http://<your-host>:3000
```

### 2. Build and run

```bash
docker compose build
docker compose up
```

The web container automatically runs `prisma db push` and seeds the database on first start.
Visit `http://<your-host>:3000`.

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

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL (must match Google Console) |
| `ENCRYPTION_KEY` | 32-byte hex key for token encryption (openssl rand -hex 32) |
| `APP_SECRET` | Password to access the app |
| `APP_URL` | Base URL of the app (used in OAuth redirects) |

---

## Roadmap

| Phase | Goal | Status |
|---|---|---|
| 0 | Definition and design | **Complete** |
| 1 | MVP: OAuth, sync, unified inbox, domains, work items | **Complete** |
| 2 | Daily usability: saved views, notes, search, activity log | Pending |
| 3 | Todoist integration | Pending |
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
