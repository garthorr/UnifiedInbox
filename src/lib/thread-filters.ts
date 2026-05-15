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
