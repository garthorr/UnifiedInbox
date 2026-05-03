-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('NEW', 'ACTIVE', 'WAITING', 'DELEGATED', 'TODOIST', 'DONE');

-- CreateEnum
CREATE TYPE "TaskProvider" AS ENUM ('TODOIST', 'OPENPROJECT');

-- CreateEnum
CREATE TYPE "RuleAction" AS ENUM ('SUGGEST_DOMAIN', 'AUTO_ASSIGN_DOMAIN', 'SUGGEST_WORK_ITEM', 'FLAG_FOR_REVIEW');

-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('ACCOUNT_CONNECTED', 'ACCOUNT_DISCONNECTED', 'ACCOUNT_SYNC_STARTED', 'ACCOUNT_SYNC_COMPLETED', 'ACCOUNT_SYNC_FAILED', 'THREAD_IMPORTED', 'THREAD_UPDATED', 'THREAD_STALE', 'WORK_ITEM_CREATED', 'WORK_ITEM_UPDATED', 'WORK_ITEM_STATUS_CHANGED', 'THREAD_ATTACHED', 'THREAD_DETACHED', 'DOMAIN_ASSIGNED', 'TASK_EXPORTED', 'TASK_SYNC_UPDATED', 'RULE_APPLIED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'GMAIL',
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "historyId" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadMirror" (
    "id" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "participantAddresses" TEXT[],
    "gmailLabelIds" TEXT[],
    "messageCount" INTEGER NOT NULL,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "isUnread" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "firstMessageAt" TIMESTAMP(3) NOT NULL,
    "historyId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "workItemId" TEXT,
    "domainId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreadMirror_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "gmailLabelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "type" TEXT NOT NULL DEFAULT 'user',

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kanbanColumns" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'NEW',
    "domainId" TEXT,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "checklist" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskLink" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "provider" "TaskProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "externalTitle" TEXT,
    "externalStatus" TEXT,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "conditions" JSONB NOT NULL,
    "action" "RuleAction" NOT NULL,
    "domainId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "eventType" "ActivityEventType" NOT NULL,
    "accountId" TEXT,
    "workItemId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE INDEX "SyncJob_status_createdAt_idx" ON "SyncJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SyncJob_accountId_status_idx" ON "SyncJob"("accountId", "status");

-- CreateIndex
CREATE INDEX "ThreadMirror_accountId_idx" ON "ThreadMirror"("accountId");

-- CreateIndex
CREATE INDEX "ThreadMirror_workItemId_idx" ON "ThreadMirror"("workItemId");

-- CreateIndex
CREATE INDEX "ThreadMirror_domainId_idx" ON "ThreadMirror"("domainId");

-- CreateIndex
CREATE INDEX "ThreadMirror_lastMessageAt_idx" ON "ThreadMirror"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ThreadMirror_isUnread_idx" ON "ThreadMirror"("isUnread");

-- CreateIndex
CREATE INDEX "ThreadMirror_isStale_idx" ON "ThreadMirror"("isStale");

-- CreateIndex
CREATE INDEX "ThreadMirror_accountId_isStale_lastMessageAt_idx" ON "ThreadMirror"("accountId", "isStale", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ThreadMirror_domainId_isStale_lastMessageAt_idx" ON "ThreadMirror"("domainId", "isStale", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ThreadMirror_workItemId_isStale_idx" ON "ThreadMirror"("workItemId", "isStale");

-- CreateIndex
CREATE UNIQUE INDEX "ThreadMirror_gmailThreadId_accountId_key" ON "ThreadMirror"("gmailThreadId", "accountId");

-- CreateIndex
CREATE INDEX "Label_accountId_idx" ON "Label"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Label_accountId_gmailLabelId_key" ON "Label"("accountId", "gmailLabelId");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_name_key" ON "Domain"("name");

-- CreateIndex
CREATE INDEX "WorkItem_domainId_idx" ON "WorkItem"("domainId");

-- CreateIndex
CREATE INDEX "WorkItem_status_idx" ON "WorkItem"("status");

-- CreateIndex
CREATE INDEX "WorkItem_dueDate_idx" ON "WorkItem"("dueDate");

-- CreateIndex
CREATE INDEX "WorkItem_status_domainId_idx" ON "WorkItem"("status", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskLink_workItemId_provider_key" ON "TaskLink"("workItemId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "TaskLink_provider_externalId_key" ON "TaskLink"("provider", "externalId");

-- CreateIndex
CREATE INDEX "Rule_isActive_priority_idx" ON "Rule"("isActive", "priority");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_accountId_idx" ON "ActivityLog"("accountId");

-- CreateIndex
CREATE INDEX "ActivityLog_workItemId_idx" ON "ActivityLog"("workItemId");

-- CreateIndex
CREATE INDEX "ActivityLog_eventType_idx" ON "ActivityLog"("eventType");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_accountId_idx" ON "ActivityLog"("createdAt", "accountId");

-- CreateIndex
CREATE INDEX "ActivityLog_eventType_createdAt_idx" ON "ActivityLog"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadMirror" ADD CONSTRAINT "ThreadMirror_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadMirror" ADD CONSTRAINT "ThreadMirror_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadMirror" ADD CONSTRAINT "ThreadMirror_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLink" ADD CONSTRAINT "TaskLink_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
