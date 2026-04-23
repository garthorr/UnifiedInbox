-- Remove duplicate pending jobs before creating the unique index.
-- Keeps only the oldest pending job per account; deletes all newer duplicates.
DELETE FROM "SyncJob"
WHERE status = 'pending'
  AND id NOT IN (
    SELECT DISTINCT ON ("accountId") id
    FROM   "SyncJob"
    WHERE  status = 'pending'
    ORDER  BY "accountId", "createdAt" ASC
  );

-- Partial unique index: at most one pending job per account.
-- Allows enqueueSyncJob to rely on the DB constraint rather than a TOCTOU findFirst+create.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "SyncJob_accountId_pending_unique"
  ON "SyncJob" ("accountId")
  WHERE status = 'pending';
