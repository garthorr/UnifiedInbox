export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";

// Server-Sent Events endpoint for live UI updates.
//
// Syncs happen in the worker process, so the web process can't be notified
// in-memory. Instead we cheaply poll a change token (thread count + latest
// thread/work-item update times) and push a `refresh` event to the browser
// only when it changes. The client responds by calling router.refresh(),
// which re-renders the server components (inbox, today, kanban, …).
//
// One module-level poller serves every open connection — N tabs share a
// single DB query per tick instead of issuing N.

const POLL_MS = 8_000;

// Only recent, live threads can change what the UI shows; scoping the
// aggregate keeps the poll an index scan instead of a full-table scan.
const WINDOW_DAYS = 30;

async function computeToken(): Promise<string> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  const [threads, workItems] = await Promise.all([
    prisma.threadMirror.aggregate({
      _count: { _all: true },
      _max: { updatedAt: true },
      where: { isStale: false, lastMessageAt: { gte: cutoff } },
    }),
    prisma.workItem.aggregate({ _max: { updatedAt: true } }),
  ]);
  const t = threads._max.updatedAt?.getTime() ?? 0;
  const w = workItems._max.updatedAt?.getTime() ?? 0;
  return `${threads._count._all}:${t}:${w}`;
}

type Subscriber = (chunk: string) => void;
const subscribers = new Set<Subscriber>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastToken = "";

function broadcast(chunk: string) {
  for (const send of subscribers) send(chunk);
}

async function pollTick() {
  try {
    const now = await computeToken();
    if (now !== lastToken) {
      lastToken = now;
      broadcast(`event: refresh\ndata: ${now}\n\n`);
    } else {
      broadcast(": ping\n\n"); // heartbeat keeps proxies from closing the connection
    }
  } catch {
    // Transient DB hiccup — ignore and try again next tick.
  }
}

function subscribe(send: Subscriber): () => void {
  subscribers.add(send);
  if (!pollTimer) {
    // Seed the token so the first tick doesn't always fire a refresh.
    computeToken()
      .then((t) => {
        lastToken = t;
      })
      .catch(() => {});
    pollTimer = setInterval(pollTick, POLL_MS);
  }
  return () => {
    subscribers.delete(send);
    if (subscribers.size === 0 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let onAbort: (() => void) | null = null;

  const cleanup = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (onAbort) {
      request.signal.removeEventListener("abort", onAbort);
      onAbort = null;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller already closed — stop receiving broadcasts.
          cleanup();
        }
      };

      send(": connected\n\n");
      unsubscribe = subscribe(send);

      // Clean up when the client disconnects. Keep a reference so the listener
      // can be removed in cleanup() — anonymous listeners leak across reconnects.
      onAbort = () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", onAbort);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tell nginx-style proxies not to buffer the stream (Traefik doesn't,
      // but this is harmless and saves debugging if the proxy ever changes).
      "X-Accel-Buffering": "no",
    },
  });
}
