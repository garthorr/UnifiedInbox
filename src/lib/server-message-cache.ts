// Server-side in-process LRU cache for fetched thread messages.
// Next.js runs as a long-lived Node.js server, so module-level state
// persists across requests — this gives us free caching without Redis.
//
// Bounded at MAX_ENTRIES to prevent OOM on long-running servers.
// Each entry can hold several hundred KB of parsed email HTML, so
// 200 entries caps this module at ~100 MB in the worst case.

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 200;

type Entry = { data: unknown; expiresAt: number };

// Map insertion order == LRU order: oldest entry is first.
const cache = new Map<string, Entry>();

function evictIfFull(): void {
  if (cache.size < MAX_ENTRIES) return;
  // Delete the oldest entry (first key in insertion order)
  const oldest = cache.keys().next().value;
  if (oldest !== undefined) cache.delete(oldest);
}

export function serverCacheGet(threadId: string): unknown | null {
  const entry = cache.get(threadId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(threadId);
    return null;
  }
  // Refresh LRU position on access
  cache.delete(threadId);
  cache.set(threadId, entry);
  return entry.data;
}

export function serverCacheSet(threadId: string, data: unknown) {
  // If updating an existing key, remove first so insertion moves it to tail
  if (cache.has(threadId)) {
    cache.delete(threadId);
  } else {
    evictIfFull();
  }
  cache.set(threadId, { data, expiresAt: Date.now() + TTL_MS });
}

export function serverCacheDelete(threadId: string) {
  cache.delete(threadId);
}
