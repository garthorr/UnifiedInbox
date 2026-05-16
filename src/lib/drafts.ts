// Client-side draft persistence backed by localStorage. Drafts auto-save on
// every keystroke so a tab close or crash never loses an in-progress message.
//
// Storage layout:
//   key   = "drafts:<id>"
//     id  = "compose:<uuid>"       (new email)
//     id  = "reply:<threadId>"     (only one reply per thread)
//   value = JSON-encoded Draft
//
// A tiny pub/sub lets the sidebar Drafts badge update reactively when
// drafts are saved or deleted in any tab.

const PREFIX = "drafts:";

export interface ComposeDraft {
  id: string;
  kind: "compose";
  accountId: string;
  to: string;
  subject: string;
  body: string;
  updatedAt: number;
}

export interface ReplyDraft {
  id: string;
  kind: "reply";
  threadId: string;
  threadSubject: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo: string | null;
  references: string | null;
  updatedAt: number;
}

export type Draft = ComposeDraft | ReplyDraft;

export function newComposeDraftId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `compose:${rand}`;
}

export function replyDraftId(threadId: string): string {
  return `reply:${threadId}`;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadDraft(id: string): Draft | null {
  const s = storage();
  if (!s) return null;
  const raw = s.getItem(PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft): void {
  const s = storage();
  if (!s) return;
  s.setItem(PREFIX + draft.id, JSON.stringify({ ...draft, updatedAt: Date.now() }));
  notify();
}

export function deleteDraft(id: string): void {
  const s = storage();
  if (!s) return;
  s.removeItem(PREFIX + id);
  notify();
}

export function listDrafts(): Draft[] {
  const s = storage();
  if (!s) return [];
  const out: Draft[] = [];
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    const raw = s.getItem(key);
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw) as Draft);
    } catch {
      // Skip corrupted entries
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

// True when the draft has anything worth keeping. Empty whitespace doesn't count.
export function isDraftEmpty(d: Draft): boolean {
  const t = (s: string) => s.trim().length === 0;
  if (d.kind === "compose") return t(d.to) && t(d.subject) && t(d.body);
  return t(d.body); // reply: only body matters (to/subject are derived)
}

// Pub/sub so the sidebar can show a live count.
type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribeDrafts(listener: Listener): () => void {
  listeners.add(listener);
  // Cross-tab updates: storage events fire in OTHER tabs only.
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith(PREFIX)) listener();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}
