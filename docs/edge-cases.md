# Edge Cases Catalog

This document lists known edge cases and the resolved handling strategy for each.
These decisions should be consistent across the UI, data model, and sync logic.

---

## EC-01: Two threads across two accounts are about the same real-world task

**Scenario:** A venue coordinator emails `troop42@gmail.com` about Spring Banquet availability.
You also forward a related catering quote from `personal@gmail.com`. Both threads are about
the same event.

**Resolution:**
The user manually attaches both threads to one work item. The app does not auto-detect that
they are related. Both `ThreadMirror` rows — from different accounts — get `workItemId` set to
the same `WorkItem.id`.

The work item detail screen shows each thread with its source account badge so the user can
tell which inbox each one came from.

No automatic merging or linking heuristic is applied in V1. In Phase 4, the rules engine may
suggest "related threads" based on shared participants or subject similarity, but the user
always confirms the link.

---

## EC-02: A thread seems to belong in two domains

**Scenario:** A parent at Lake Highlands Church who is also a Troop 42 family emails you about
something that touches both roles. The thread genuinely lives in two worlds.

**Resolution:**
One domain per work item. Pick the domain that is the **primary driver of action** — who you
are responding as, which context the relationship lives in.

If action is needed in both domains, create two separate work items (one per domain) and attach
the same thread to whichever work item is more relevant. The other work item can note the
cross-domain context in its notes field.

Note: since a thread can only belong to one work item, the second work item would need to
reference the situation in its notes rather than having the thread directly attached. This is
an acceptable limitation in V1.

---

## EC-03: Reassigning a thread from one work item to another

**Scenario:** The user created a work item for "Campout Planning" and attached three threads.
Later, they realize one of those threads is actually about a separate "Equipment Purchase" item.

**Resolution:**
The user opens the work item detail, finds the thread, clicks `[Detach]`. The thread's
`workItemId` is set to `null` (unlinked). It reappears in the domain's unlinked threads section.
The user can then open or create a different work item and use `[+ Attach a Thread]` to link it.

Both events are logged in `ActivityLog`:
- `THREAD_DETACHED` — from the original work item
- `THREAD_ATTACHED` — to the new work item

The original work item is not affected beyond losing that thread. Its status, notes, and other
threads are unchanged.

---

## EC-04: A Gmail thread is deleted or permanently archived

**Scenario:** The user or someone else deletes a thread from Gmail. On the next sync, the
Gmail API returns a 404 for that thread ID.

**Resolution:**
The sync job sets `ThreadMirror.isStale = true` and logs `THREAD_STALE` in `ActivityLog`.
The `ThreadMirror` row is NOT deleted.

If the thread was attached to a work item, the work item detail shows a warning banner:
> "One attached thread is no longer accessible in Gmail. It may have been deleted or moved."

The work item itself is not deleted. Its notes, status, checklist, and other threads are
preserved. The stale thread card shows a grayed-out indicator and the `[Open in Gmail ↗]`
link is disabled.

The user can choose to detach the stale thread at any time. The stale `ThreadMirror` row is
kept for audit purposes but marked visually as unavailable.

---

## EC-05: A reply is sent from the wrong Gmail account

**Scenario:** The user is logged into `personal@gmail.com` in their browser and accidentally
replies to a Troop 42 email from that account instead of `troop42@gmail.com`.

**Resolution:**
The sent reply appears in `personal@gmail.com`'s Sent label and gets synced as a
`ThreadMirror` on the personal account. The original thread on `troop42@gmail.com` also
receives the reply and updates its snippet and message count on the next sync.

The app does not detect that these are related. If the user wants both threads in the same
work item, they must manually attach both.

No automatic cross-account thread linking occurs. The app has no way to know whether a sent
message from one account was intentional or a mistake.

This is a Gmail-layer problem (the user can recall or re-send from the correct account) and
not something the work console should try to fix.

---

## EC-06: A thread's subject line changes mid-conversation

**Scenario:** A long thread starts as "Spring Banquet" but someone replies with a new subject
like "Re: Re: Venue Question" and Gmail creates a new thread.

**Resolution:**
Gmail splits the conversation into a new thread when the subject changes significantly. The
sync will import the new thread separately. The user will see both threads in the unified inbox.

They can attach both to the same work item using `[+ Attach a Thread]`. No automatic detection
of subject-similarity-based thread merging occurs in V1.

The original thread's subject stored in `ThreadMirror.subject` does not change as replies
arrive; Gmail stores the subject at the thread level, not per-message.

---

## EC-07: A thread has 100+ messages (very long conversation)

**Scenario:** A school mailing list or high-volume committee thread accumulates 150+ messages
over months.

**Resolution:**
`ThreadMirror` stores only thread-level metadata, not individual messages. The `messageCount`
field shows the true count. The `snippet` field always reflects the latest message.

The app will display:
> "📎 150 messages · last from parent@mail.com · 2h ago"

No performance issue exists in the app layer since bodies are not stored. The `[Open in Gmail ↗]`
link opens the full thread in Gmail, which is the right tool for reading long conversations.

There is no per-message view in V1. Viewing the thread always defers to Gmail.

---

## EC-08: The same sender contacts multiple domains

**Scenario:** A parent is both a Troop 42 family and a church attendee. Their emails arrive
in both `troop42@gmail.com` and the church email alias.

**Resolution:**
Domain assignment is per thread and per work item, not per sender. The same person's emails
in different accounts are independent `ThreadMirror` rows assigned to their respective domains.

In Phase 4, rules can be configured to assign domains based on the **receiving account**, not
just the sender. So "anything received on `troop42@gmail.com` → suggest Troop 42" would handle
this correctly even if the same sender contacts both.

---

## EC-09: An account's OAuth token is revoked or expires without refresh

**Scenario:** The user revokes app access from their Google account settings, or the refresh
token expires due to inactivity (Google expires refresh tokens after 6 months of non-use for
some app types).

**Resolution:**
On the next sync attempt, the API returns a 401. The sync job:
1. Attempts a token refresh using the stored `refreshToken`.
2. If the refresh succeeds → updates `accessToken` and `tokenExpiresAt`, continues sync.
3. If the refresh fails → sets `Account.isActive = false`, logs `ACCOUNT_SYNC_FAILED`, and
   surfaces a persistent warning in the UI: "Account disconnected — re-authenticate to resume."

All existing `ThreadMirror` rows, work items, and history are preserved. Sync is simply paused
until the user re-authenticates by clicking the "Re-connect" button (which re-launches OAuth).

---

## EC-10: A work item is created before a domain is assigned

**Scenario:** The user is processing the unified intake and creates a work item quickly without
deciding on a domain yet. They want to triage domain assignment separately.

**Resolution:**
`WorkItem.domainId` is nullable. A work item can be saved without a domain.

In the UI:
- The work item shows as "Unassigned" with a gray indicator.
- An "Unassigned" section appears in the domain sidebar with a count badge.
- The user can open the work item and assign a domain at any time using the `[Domain ▼]` picker.

No sync or export operations require a domain. Todoist export (Phase 3) will prompt for domain
selection if unassigned, since the domain determines the Todoist project target.

---

## EC-11: A ThreadMirror is updated in Gmail (labels change, new messages arrive) after being attached to a work item

**Scenario:** A thread attached to "Spring Banquet 2026" receives a new reply. The work item
was already in WAITING status.

**Resolution:**
The sync job updates the `ThreadMirror` row: `snippet`, `messageCount`, `lastMessageAt`,
`isUnread`, `gmailLabelIds`, and `historyId` are refreshed.

The work item's status is **not automatically changed**. The app does not know whether the new
reply resolves the wait or starts a new back-and-forth. Status changes are always user actions.

However, in Phase 2, the unified intake and domain pile views will visually flag threads with
new activity since last visit (a "new message" indicator on the thread card within the work item
detail). This surfaces the update without auto-changing status.

---

## EC-12: User removes an account that has threads attached to work items

**Scenario:** The user disconnects `troop42@gmail.com`. That account has 300 threads mirrored,
many attached to active work items.

**Resolution:**
Before deletion, the UI shows a warning:
> "This account has 47 threads attached to work items. Removing the account will stop syncing
> and those threads will become static. Work items will be preserved. Continue?"

On confirmation:
- `Account` row is deleted (or soft-deleted with `isActive = false`).
- `ThreadMirror` rows are **not deleted** by default. They become static (no further sync).
  Their `workItemId` references remain intact.
- `ActivityLog` rows referencing the account have `accountId` set to null via `SetNull`.
- Work items continue to exist with the stale thread data visible.

Optionally, a "Remove account and delete all threads" option could be offered in Phase 2 for
cleanup, but the default in V1 is to preserve thread mirrors.

---

## Summary Table

| # | Edge Case | V1 Resolution |
|---|---|---|
| EC-01 | Two threads, same task, different accounts | Manual multi-attach to one work item |
| EC-02 | Thread belongs in two domains | One domain; use notes for cross-domain context |
| EC-03 | Reassign thread between work items | Detach → reappears unlinked → attach to new WI |
| EC-04 | Gmail thread deleted | Mark `isStale`, warn in UI, preserve work item |
| EC-05 | Reply from wrong account | No auto-link; user manually attaches if desired |
| EC-06 | Subject changes mid-thread (new Gmail thread) | Import as separate thread; user attaches both to WI |
| EC-07 | Very long thread (100+ messages) | Metadata only; open in Gmail for full read |
| EC-08 | Same sender in multiple domains | Per-thread domain assignment; account-based rules in Phase 4 |
| EC-09 | OAuth token revoked | Set `isActive = false`, warn user, preserve data |
| EC-10 | Work item created without domain | Nullable `domainId`; visible as "Unassigned" |
| EC-11 | Thread updated after WI attachment | Sync updates ThreadMirror; status unchanged |
| EC-12 | Account removed with attached threads | Preserve ThreadMirrors as static; warn before delete |
