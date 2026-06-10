import type { Prisma } from "@prisma/client";

/**
 * Match threads that are *not currently snoozed* — either they were never
 * snoozed (`snoozedUntil = null`) or their snooze period has already elapsed
 * (`snoozedUntil <= now`). Returns a Prisma `where`-fragment safe to spread
 * into a larger condition or to nest under `AND` when combined with `OR`s.
 */
export function notSnoozedFilter(): Prisma.ThreadMirrorWhereInput {
  return {
    OR: [
      { snoozedUntil: null },
      { snoozedUntil: { lte: new Date() } },
    ],
  };
}

/** Match threads that ARE currently snoozed (snoozedUntil > now). */
export function isSnoozedFilter(): Prisma.ThreadMirrorWhereInput {
  return { snoozedUntil: { gt: new Date() } };
}

// Gmail labels for mail the user shouldn't see in normal views. Gmail's
// search-based initial sync already drops these, but the incremental History
// API surfaces spam/trash label changes, so threads can still land in the
// mirror carrying these labels. (IMAP threads are always labelled "INBOX".)
export const HIDDEN_LABELS = ["SPAM", "TRASH"] as const;

/**
 * Exclude spam/trash threads. Applied to every default listing (inbox, today,
 * snoozed, domain views) so "All Mail" means all real mail, not spam.
 */
export function notSpamFilter(): Prisma.ThreadMirrorWhereInput {
  return { NOT: { gmailLabelIds: { hasSome: [...HIDDEN_LABELS] } } };
}

