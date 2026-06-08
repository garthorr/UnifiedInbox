-- Web Push notifications + task reminders.

-- Reminder fields on work items.
ALTER TABLE "WorkItem" ADD COLUMN IF NOT EXISTS "remindAt" TIMESTAMP(3);
ALTER TABLE "WorkItem" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "WorkItem_remindAt_reminderSentAt_idx"
  ON "WorkItem" ("remindAt", "reminderSentAt");

-- Browser Web Push subscriptions (one row per device/browser).
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id"         TEXT NOT NULL,
  "endpoint"   TEXT NOT NULL,
  "p256dh"     TEXT NOT NULL,
  "auth"       TEXT NOT NULL,
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key"
  ON "PushSubscription" ("endpoint");

-- Single-row notification preferences table (id pinned to 'singleton').
CREATE TABLE IF NOT EXISTS "NotificationSetting" (
  "id"              TEXT NOT NULL DEFAULT 'singleton',
  "newMailEnabled"  BOOLEAN NOT NULL DEFAULT true,
  "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  "quietHoursStart" INTEGER,
  "quietHoursEnd"   INTEGER,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);
