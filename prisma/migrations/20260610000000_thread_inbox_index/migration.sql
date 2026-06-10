-- Covering index for the unfiltered inbox/today query shape:
--   WHERE "isStale" = false AND "lastMessageAt" >= cutoff
--   ORDER BY "lastMessageAt" DESC
-- The existing compound indexes all lead with accountId/domainId/workItemId,
-- so the no-filter case fell back to the single-column lastMessageAt index.
CREATE INDEX IF NOT EXISTS "ThreadMirror_isStale_lastMessageAt_idx"
  ON "ThreadMirror" ("isStale", "lastMessageAt");
