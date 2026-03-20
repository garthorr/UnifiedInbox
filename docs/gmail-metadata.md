# Gmail Metadata Model

## Decision: Read-Only in V1

The app **never writes to Gmail** in V1. No label changes, no archiving, no starring, no marking
as read. Gmail remains the authoritative system of record for all email state. This makes the app
safe to use alongside Gmail and easy to reason about.

Write-back (e.g. applying a `console/processed` label when a work item is marked DONE) is a
potential Phase 2 feature, but it is explicitly out of scope for the initial build.

---

## What Is Mirrored Locally (ThreadMirror table)

These fields are stored in PostgreSQL and kept current by the sync job. They are sufficient for
triage, filtering, searching, and linking threads to work items — without fetching message bodies.

| Field | Gmail API source | Notes |
|---|---|---|
| `gmailThreadId` | `threads.id` | Gmail's stable thread ID |
| `subject` | `messages[0].payload.headers["Subject"]` | Subject from the first message in thread |
| `snippet` | `threads.snippet` | Gmail's auto-generated preview of latest message (~200 chars) |
| `participantAddresses` | Headers across all messages: From, To, Cc | Deduplicated list of all email addresses in the conversation |
| `gmailLabelIds` | `threads.labelIds` | Array of Gmail label IDs (INBOX, UNREAD, SENT, STARRED, etc.) |
| `messageCount` | `threads.messagesEstimate` or `messages.length` | Total messages in thread |
| `hasAttachments` | Presence of `parts` with `mimeType != text/*` in any message | Boolean derived from message structure |
| `isUnread` | Derived: `gmailLabelIds.includes("UNREAD")` | Stored for fast filtering without re-parsing labels |
| `lastMessageAt` | `messages[-1].internalDate` | Unix ms timestamp of most recent message |
| `firstMessageAt` | `messages[0].internalDate` | Unix ms timestamp of original message |
| `historyId` | `threads.historyId` | Opaque cursor used for incremental sync |
| `isStale` | App-derived | Set to true when Gmail returns 404 for this thread ID |

---

## What Is NOT Mirrored (Fetched On Demand)

These fields are not stored locally. When the user needs them (e.g. to read a message or reply),
the app opens Gmail directly or fetches via API on demand.

| Data | Why not mirrored |
|---|---|
| Full message body (HTML/plain text) | Storage cost; privacy; stale risk; Gmail search is better for full-text |
| Attachment content | Storage cost; not needed for triage |
| Individual message headers (From, Date, Message-ID per message) | Thread-level metadata is sufficient for V1 |
| Draft state | Drafts are Gmail-native; the app does not manage them |
| Starred state | Stored in `gmailLabelIds` as `STARRED`; separate field not needed |
| Conversation history (per-message read state) | Thread-level `isUnread` is sufficient |
| Sender profile pictures / contact details | Not available from Gmail API without Contacts API |

---

## Sync Strategy

### Initial Sync

On first connection of an account:

1. Call `users.threads.list` with `maxResults=500` and a date filter (e.g. `after:YYYY/MM/DD`
   for the last 90 days by default).
2. For each thread ID returned, call `users.threads.get` with `format=METADATA` and
   `metadataHeaders=Subject,From,To,Cc,Date` to retrieve thread-level metadata and message
   headers without fetching bodies.
3. Insert a `ThreadMirror` row for each thread.
4. Store the most recent `historyId` from the response for future incremental syncs.
5. Log `ACCOUNT_SYNC_COMPLETED` in `ActivityLog` with thread count.

The sync window (default 90 days, configurable) and thread cap (default 500 per account,
configurable) prevent unbounded initial syncs.

### Incremental Sync

On each subsequent sync (scheduled or manual):

1. Call `users.history.list` with the stored `historyId`.
2. Process history events:
   - `messagesAdded` → new message in a thread; update `snippet`, `messageCount`,
     `lastMessageAt`, `isUnread`, `gmailLabelIds`, `historyId` in the existing `ThreadMirror`,
     or insert a new row if the thread is new.
   - `labelsAdded` / `labelsRemoved` → update `gmailLabelIds` and `isUnread`.
   - `messagesDeleted` → mark `isStale = true` if entire thread is deleted.
3. Update `lastSyncAt` on the `Account` row.
4. Log `ACCOUNT_SYNC_COMPLETED` with counts of new and updated threads.

If `historyId` is expired (Gmail returns a 404 on history), fall back to a full re-sync for
that account.

### Failure Handling

| Failure | Behavior |
|---|---|
| 401 Unauthorized | Attempt token refresh. If refresh fails, set `isActive = false` on Account. Surface warning in UI. |
| 429 Rate Limited | Back off with exponential delay. Log `ACCOUNT_SYNC_FAILED`. Retry on next scheduled interval. |
| 404 on thread fetch | Mark `ThreadMirror.isStale = true`. Log `THREAD_STALE`. Do not delete. |
| 404 on history.list | Trigger full re-sync. Log event. |
| Network timeout | Log failure. Retry on next interval. |

### Sync Frequency

Default: every 15 minutes when the app is in use. Configurable per account.
No background sync is required when the app tab is closed (V1); sync resumes when user opens the app.

---

## Gmail Deep Links

Each `ThreadMirror` can generate a deep link to the original Gmail thread using:

```
https://mail.google.com/mail/u/0/#inbox/{gmailThreadId}
```

The `u/0` segment refers to the Gmail account index in the browser session. For multi-account
users, this may need to be the correct account index. In V1, surface the account email address
alongside the link and let the user switch accounts in their browser if needed. A more robust
solution (linking directly to the correct Google account) is a Phase 2 improvement.

---

## Privacy and Security Notes

- `accessToken` and `refreshToken` must be encrypted at rest. The app reads them only when
  making API calls. They are never exposed to the frontend.
- Thread metadata (subjects, participant addresses, snippets) is sensitive. The database
  should not be publicly accessible. In V1, the entire app is self-hosted behind authentication.
- No email content is stored. If a user deletes their account or revokes OAuth, there is no
  email content to purge — only metadata, which is deleted with the `Account` row.
