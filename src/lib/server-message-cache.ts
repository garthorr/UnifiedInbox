// Server-side in-process cache for fetched thread messages.
// Next.js runs as a long-lived Node.js server, so module-level state
// persists across requests — this gives us free caching without Redis.

const TTL_MS = 5 * 60 * 1000; // 5 minutes

type Entry = { data: unknown; expiresAt: number };
const cache = new Map<string, Entry>();

export function serverCacheGet(threadId: string): unknown | null {
  const entry = cache.get(threadId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(threadId);
    return null;
  }
  return entry.data;
}

export function serverCacheSet(threadId: string, data: unknown) {
  cache.set(threadId, { data, expiresAt: Date.now() + TTL_MS });
}

export function serverCacheDelete(threadId: string) {
  cache.delete(threadId);
}
