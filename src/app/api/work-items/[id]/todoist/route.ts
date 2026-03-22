import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createTask, isConfigured } from "@/lib/todoist";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Todoist is not configured. Add TODOIST_API_KEY to .env." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({})) as {
    projectId?: string;
    sectionId?: string;
  };

  const workItem = await prisma.workItem.findUnique({
    where: { id },
    include: { taskLinks: { where: { provider: "TODOIST" } } },
  });

  if (!workItem) {
    return NextResponse.json({ error: "Work item not found" }, { status: 404 });
  }

  if (workItem.taskLinks.length > 0) {
    return NextResponse.json(
      { error: "Already linked to a Todoist task" },
      { status: 409 }
    );
  }

  const task = await createTask({
    title: workItem.title,
    notes: workItem.notes,
    dueDate: workItem.dueDate,
    projectId: body.projectId ?? null,
    sectionId: body.sectionId ?? null,
  });

  const [taskLink] = await prisma.$transaction([
    prisma.taskLink.create({
      data: {
        workItemId: id,
        provider: "TODOIST",
        externalId: task.id,
        externalUrl: task.url,
        externalTitle: task.content,
        exportedAt: new Date(),
        lastSyncAt: new Date(),
      },
    }),
    prisma.workItem.update({
      where: { id },
      data: { status: "TODOIST" },
    }),
    prisma.activityLog.create({
      data: {
        eventType: "WORK_ITEM_STATUS_CHANGED",
        workItemId: id,
        description: `Exported to Todoist: ${task.url}`,
        metadata: {
          from: workItem.status,
          to: "TODOIST",
          todoistTaskId: task.id,
          ...(body.projectId && { todoistProjectId: body.projectId }),
          ...(body.sectionId && { todoistSectionId: body.sectionId }),
        },
      },
    }),
  ]);

  return NextResponse.json(taskLink, { status: 201 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const taskLink = await prisma.taskLink.findFirst({
    where: { workItemId: id, provider: "TODOIST" },
  });

  if (!taskLink) {
    return NextResponse.json({ error: "No Todoist link found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.taskLink.delete({ where: { id: taskLink.id } }),
    prisma.activityLog.create({
      data: {
        eventType: "WORK_ITEM_UPDATED",
        workItemId: id,
        description: "Todoist link removed",
        metadata: { todoistTaskId: taskLink.externalId },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
