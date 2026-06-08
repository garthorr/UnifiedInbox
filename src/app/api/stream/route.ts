export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";

// Server-Sent Events endpoint for live UI updates.
//
// Syncs happen in the worker process, so the web process can't be notified
// in-memory. Instead we cheaply poll a change token (thread count + latest
// thread/work-item update times) and push a `refresh` event to the browser
// only when it changes. The client responds by calling router.refresh(),
// which re-renders the server components (inbox, today, kanban, …).

const POLL_MS = 8_000;

async function computeToken(): Promise<string> {
  const [threads, workItems] = await Promise.all([
    prisma.threadMirror.aggregate({
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.workItem.aggregate({ _max: { updatedAt: true } }),
  ]);
  const t = threads._max.updatedAt?.getTime() ?? 0;
  const w = workItems._max.updatedAt?.getTime() ?? 0;
  return `${threads._count._all}:${t}:${w}`;
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller already closed — stop polling.
          if (interval) clearInterval(interval);
        }
      };

      let last = await computeToken().catch(() => "");
      send(": connected\n\n");

      interval = setInterval(async () => {
        try {
          const now = await computeToken();
          if (now !== last) {
            last = now;
            send(`event: refresh\ndata: ${now}\n\n`);
          } else {
            send(": ping\n\n"); // heartbeat keeps proxies from closing the connection
          }
        } catch {
          // Transient DB hiccup — ignore and try again next tick.
        }
      }, POLL_MS);

      // Clean up when the client disconnects.
      request.signal.addEventListener("abort", () => {
        if (interval) clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
