// Client-side LRU cache for thread messages.
// Lives for the browser session; evicts oldest entry when the cap is reached.
// Shared between EmailViewer (reads/writes) and InboxPane (prefetch writes).

const MAX = 100;

class LRUMap {
  private map = new Map<string, unknown>();

  get(key: string): unknown | undefined {
    return this.map.get(key);
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
