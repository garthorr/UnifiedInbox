-- Enable trigram extension for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for array columns (enables fast @> and && queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ThreadMirror_gmailLabelIds_gin"
  ON "ThreadMirror" USING GIN ("gmailLabelIds");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ThreadMirror_participantAddresses_gin"
  ON "ThreadMirror" USING GIN ("participantAddresses");

-- GIN trigram indexes for ILIKE / contains text search
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ThreadMirror_subject_trgm"
  ON "ThreadMirror" USING GIN ("subject" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ThreadMirror_snippet_trgm"
  ON "ThreadMirror" USING GIN ("snippet" gin_trgm_ops);
