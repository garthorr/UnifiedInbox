import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTask, isConfigured } from "@/lib/todoist";

/**
 * POST /api/todoist/sync
 *
 * Polls Todoist for the status of all linked tasks and syncs back to WorkItems.
 * - If a Todoist task is completed, set WorkItem.status = "DONE"
 * - Updates TaskLink.externalStatus and lastSyncAt
 *
 * Call this from the worker on a schedule (e.g. every 15 min alongside Gmail sync).
 */
export async function POST() {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Todoist is not configured" },
      { status: 503 }
    );
  }

  const links = await prisma.taskLink.findMany({
    where: { provider: "TODOIST" },
    include: {
      workItem: { select: { id: true, status: true } },
    },
  });

  if (links.length === 0) {
    return NextResponse.json({ synced: 0, completed: 0 });
  }

  let synced = 0;
  let completed = 0;
  const errors: string[] = [];

  await Promise.all(
    links.map(async (link) => {
      try {
        const task = await getTask(link.externalId);
        const now = new Date();

        if (task.is_completed && link.workItem.status !== "DONE") {
          await prisma.$transaction([
            prisma.taskLink.update({
              where: { id: link.id },
              data: { externalStatus: "completed", externalTitle: task.content, lastSyncAt: now },
            }),
            prisma.workItem.update({
              where: { id: link.workItem.id },
              data: { status: "DONE" },
            }),
            prisma.activityLog.create({
              data: {
                eventType: "WORK_ITEM_STATUS_CHANGED",
                workItemId: link.workItem.id,
                description: `Marked DONE via Todoist task completion`,
                metadata: {
                  from: link.workItem.status,
                  to: "DONE",
                  todoistTaskId: link.externalId,
                },
              },
            }),
          ]);
          completed++;
        } else {
          await prisma.taskLink.update({
            where: { id: link.id },
            data: { externalStatus: task.is_completed ? "completed" : "active", externalTitle: task.content, lastSyncAt: now },
          });
        }
        synced++;
      } catch (err) {
        errors.push(`TaskLink ${link.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  return NextResponse.json({ synced, completed, errors });
}
