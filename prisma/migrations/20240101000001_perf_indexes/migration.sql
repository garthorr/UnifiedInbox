-- Enable trigram extension for ILIKE / contains text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for array columns (enables fast @> and && queries)
CREATE INDEX IF NOT EXISTS "ThreadMirror_gmailLabelIds_gin"
  ON "ThreadMirror" USING GIN ("gmailLabelIds");

CREATE INDEX IF NOT EXISTS "ThreadMirror_participantAddresses_gin"
  ON "ThreadMirror" USING GIN ("participantAddresses");

-- GIN trigram indexes for subject / snippet full-text search
CREATE INDEX IF NOT EXISTS "ThreadMirror_subject_trgm"
  ON "ThreadMirror" USING GIN ("subject" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ThreadMirror_snippet_trgm"
  ON "ThreadMirror" USING GIN ("snippet" gin_trgm_ops);

-- Remove duplicate pending jobs before creating the partial unique index
DELETE FROM "SyncJob"
WHERE status = 'pending'
  AND id NOT IN (
    SELECT DISTINCT ON ("accountId") id
    FROM   "SyncJob"
    WHERE  status = 'pending'
    ORDER  BY "accountId", "createdAt" ASC
  );

-- Partial unique index: at most one pending job per account
CREATE UNIQUE INDEX IF NOT EXISTS "SyncJob_accountId_pending_unique"
  ON "SyncJob" ("accountId")
  WHERE status = 'pending';
