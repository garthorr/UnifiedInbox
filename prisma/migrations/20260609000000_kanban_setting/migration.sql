-- Global Kanban board configuration (single-row table, id pinned to 'singleton').
-- Per-domain boards override via Domain.kanbanColumns; the global /kanban board
-- reads its column order / labels / visibility from here.
CREATE TABLE IF NOT EXISTS "KanbanSetting" (
  "id"        TEXT NOT NULL DEFAULT 'singleton',
  "columns"   JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KanbanSetting_pkey" PRIMARY KEY ("id")
);
