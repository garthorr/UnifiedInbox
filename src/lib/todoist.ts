const TODOIST_API = "https://api.todoist.com/api/v1";

function apiKey() {
  const key = process.env.TODOIST_API_KEY;
  if (!key) throw new Error("TODOIST_API_KEY is not configured");
  return key;
}

function headers() {
  return {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
  };
}

export interface TodoistTask {
  id: string;
  content: string;
  description: string;
  is_completed: boolean;
  url: string;
  due?: { date: string } | null;
}

export interface TodoistProject {
  id: string;
  name: string;
  parent_id: string | null;
  order: number;
  color: string;
  is_inbox_project: boolean;
}

export interface TodoistSection {
  id: string;
  project_id: string;
  name: string;
  order: number;
}

async function fetchAllPages<T>(url: string, label: string): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  do {
    const pageUrl = cursor ? `${url}${url.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}` : url;
    const res = await fetch(pageUrl, { headers: { Authorization: `Bearer ${apiKey()}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Todoist ${label} failed ${res.status}: ${text}`);
    }
    const data: { results: T[]; next_cursor: string | null; has_more: boolean } = await res.json();
    all.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return all;
}

export async function listProjects(): Promise<TodoistProject[]> {
  const projects = await fetchAllPages<TodoistProject>(`${TODOIST_API}/projects`, "listProjects");
  return projects.sort((a, b) => a.order - b.order);
}

export async function listSections(projectId: string): Promise<TodoistSection[]> {
  const sections = await fetchAllPages<TodoistSection>(
    `${TODOIST_API}/sections?project_id=${encodeURIComponent(projectId)}`,
    "listSections"
  );
  return sections.sort((a, b) => a.order - b.order);
}

export async function createTask(opts: {
  title: string;
  notes?: string | null;
  dueDate?: Date | string | null;
  projectId?: string | null;
  sectionId?: string | null;
  threadUrls?: string[];
}): Promise<TodoistTask> {
  const body: Record<string, unknown> = { content: opts.title };

  // Build description: notes + email thread back-links
  let desc = opts.notes ?? "";
  if (opts.threadUrls?.length) {
    const links = opts.threadUrls.map((u) => `📧 ${u}`).join("\n");
    desc = desc ? `${desc}\n\n${links}` : links;
  }
  if (desc) body.description = desc;
  if (opts.dueDate) {
    const d = new Date(opts.dueDate);
    body.due_date = d.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  // Explicit selection takes precedence over env default
  const projectId = opts.projectId ?? process.env.TODOIST_PROJECT_ID;
  if (projectId) body.project_id = projectId;
  if (opts.sectionId) body.section_id = opts.sectionId;

  const res = await fetch(`${TODOIST_API}/tasks`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Todoist createTask failed ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getTask(taskId: string): Promise<TodoistTask> {
  const res = await fetch(`${TODOIST_API}/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Todoist getTask failed ${res.status}: ${text}`);
  }
  return res.json();
}

export async function closeTask(taskId: string): Promise<void> {
  const res = await fetch(`${TODOIST_API}/tasks/${taskId}/close`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Todoist closeTask failed ${res.status}: ${text}`);
  }
}

export function isConfigured(): boolean {
  return !!process.env.TODOIST_API_KEY;
}

// ─── Sync helper (used by worker + /api/todoist/sync) ─────────────────────────

import { prisma } from "@/lib/db";

export interface TodoistSyncResult {
  synced: number;
  completed: number;
  errors: string[];
}

/**
 * Poll Todoist for all linked non-DONE tasks and update local state.
 * Runs up to `concurrency` tasks in parallel (default 5) to respect
 * Todoist's rate limit while still being much faster than serial iteration.
 */
export async function syncTodoistLinks(concurrency = 5): Promise<TodoistSyncResult> {
  const links = await prisma.taskLink.findMany({
    where: {
      provider: "TODOIST",
      workItem: { status: { not: "DONE" } },
    },
    include: { workItem: { select: { id: true, title: true, status: true } } },
  });

  if (links.length === 0) return { synced: 0, completed: 0, errors: [] };

  let synced = 0;
  let completed = 0;
  const errors: string[] = [];

  // Work-stealing concurrency: `concurrency` workers each pull from the shared queue.
  const queue = [...links];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, links.length) }, async () => {
      while (queue.length > 0) {
        const link = queue.shift()!;
        try {
          const task = await getTask(link.externalId);
          const now = new Date();

          if (task.is_completed) {
            await prisma.$transaction([
              prisma.workItem.update({
                where: { id: link.workItemId },
                data: { status: "DONE" },
              }),
              prisma.taskLink.update({
                where: { id: link.id },
                data: { externalStatus: "completed", externalTitle: task.content, lastSyncAt: now },
              }),
              prisma.activityLog.create({
                data: {
                  eventType: "WORK_ITEM_STATUS_CHANGED",
                  workItemId: link.workItemId,
                  description: `Marked DONE via Todoist completion`,
                  metadata: { from: link.workItem.status, to: "DONE", todoistTaskId: link.externalId },
                },
              }),
            ]);
            completed++;
          } else {
            await prisma.taskLink.update({
              where: { id: link.id },
              data: { externalStatus: "active", externalTitle: task.content, lastSyncAt: now },
            });
          }
          synced++;
        } catch (err) {
          errors.push(`TaskLink ${link.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    })
  );

  return { synced, completed, errors };
}
