-- Partial unique index: at most one pending job per account.
-- Allows enqueueSyncJob to rely on the DB constraint rather than a TOCTOU findFirst+create.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "SyncJob_accountId_pending_unique"
  ON "SyncJob" ("accountId")
  WHERE status = 'pending';
