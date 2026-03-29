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
}): Promise<TodoistTask> {
  const body: Record<string, unknown> = { content: opts.title };
  if (opts.notes) body.description = opts.notes;
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
