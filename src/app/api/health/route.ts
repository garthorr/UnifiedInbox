import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Worker beats every 30s; allow three missed beats before calling it dead.
const WORKER_STALE_MS = 90_000;

export async function GET() {
  try {
    const worker = await prisma.workerStatus.findUnique({ where: { id: "singleton" } });
    const workerAlive =
      !!worker && Date.now() - worker.heartbeatAt.getTime() < WORKER_STALE_MS;

    // A dead worker degrades the response body but not the status code —
    // this endpoint gates the *web* container's liveness, and restarting
    // the web container won't fix the worker.
    return NextResponse.json({
      status: workerAlive ? "ok" : "degraded",
      worker: workerAlive ? "alive" : worker ? "stale" : "never started",
      workerHeartbeatAt: worker?.heartbeatAt ?? null,
    });
  } catch {
    return NextResponse.json({ status: "error", reason: "db unreachable" }, { status: 503 });
  }
}
