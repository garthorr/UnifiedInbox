-- Thread snoozing: hide a thread from default views until a chosen time.
ALTER TABLE "ThreadMirror" ADD COLUMN IF NOT EXISTS "snoozedUntil" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ThreadMirror_snoozedUntil_idx"
  ON "ThreadMirror" ("snoozedUntil");
