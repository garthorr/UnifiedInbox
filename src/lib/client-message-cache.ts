// Client-side LRU cache for thread messages.
// Lives for the browser session; evicts oldest entry when the cap is reached.
// Shared between EmailViewer (reads/writes) and InboxPane (prefetch writes).

const MAX = 100;

class LRUMap {
  private map = new Map<string, unknown>();

  get(key: string): unknown | undefined {
    const value = this.map.get(key);
    // Refresh recency so frequently-read entries aren't evicted first.
    // Without this the "LRU" degrades to FIFO (insertion-order eviction).
    if (value !== undefined && this.map.has(key)) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: string, value: unknown) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= MAX) {
      this.map.delete(this.map.keys().next().value!);
    }
    this.map.set(key, value);
  }

  delete(key: string) {
    this.map.delete(key);
  }

  has(key: string) {
    return this.map.has(key);
  }
}

export const messageCache = new LRUMap();
