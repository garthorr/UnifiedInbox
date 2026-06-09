import type { WorkItemStatus } from "@prisma/client";

// Canonical Kanban column configuration shared by the global board, per-domain
// boards, and the config endpoints. A "column" is a bucket the user can rename,
// reorder, and show/hide; `status` is the underlying WorkItemStatus it maps to.
export interface KanbanColumnConfig {
  status: WorkItemStatus;
  label: string;
  visible: boolean;
}

// Default column order + labels. DONE is intentionally omitted — completed work
// items drop off the board.
const DEFAULT_ORDER: { status: WorkItemStatus; label: string }[] = [
  { status: "ACTIVE", label: "Active" },
  { status: "WAITING", label: "Waiting" },
  { status: "DELEGATED", label: "Delegated" },
  { status: "NEW", label: "New" },
  { status: "TODOIST", label: "In Todoist" },
];

export function defaultKanbanColumns(): KanbanColumnConfig[] {
  return DEFAULT_ORDER.map(({ status, label }) => ({ status, label, visible: true }));
}

/**
 * Normalize a stored `kanbanColumns` JSON value (from KanbanSetting or
 * Domain.kanbanColumns) into a valid column list, falling back to defaults when
 * the value is missing or malformed. Also backfills any default columns that
 * aren't present in stored config (e.g. a status added after the config was
 * saved) so new buckets don't silently disappear.
 */
export function resolveKanbanColumns(stored: unknown): KanbanColumnConfig[] {
  const defaults = defaultKanbanColumns();
  if (!Array.isArray(stored) || stored.length === 0) return defaults;

  const valid = stored.filter(
    (c): c is KanbanColumnConfig =>
      !!c &&
      typeof c === "object" &&
      typeof (c as KanbanColumnConfig).status === "string" &&
      typeof (c as KanbanColumnConfig).label === "string" &&
      typeof (c as KanbanColumnConfig).visible === "boolean"
  );
  if (valid.length === 0) return defaults;

  // Append any default statuses missing from the stored config (hidden by
  // default so an explicit user layout isn't disrupted).
  const present = new Set(valid.map((c) => c.status));
  const missing = defaults
    .filter((d) => !present.has(d.status))
    .map((d) => ({ ...d, visible: false }));

  return [...valid, ...missing];
}
