import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { closeTask, isConfigured } from "@/lib/todoist";
import type { WorkItemStatus } from "@prisma/client";

const VALID_STATUSES: WorkItemStatus[] = [
  "NEW",
  "ACTIVE",
  "WAITING",
  "DELEGATED",
  "TODOIST",
  "DONE",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const workItem = await prisma.workItem.findUnique({
    where: { id },
    include: {
      domain: { select: { id: true, name: true, color: true } },
      threads: {
        where: { isStale: false },
        orderBy: { lastMessageAt: "desc" },
        include: {
          account: { select: { id: true, email: true, displayName: true } },
        },
      },
      taskLinks: true,
      activityLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          account: { select: { id: true, email: true } },
        },
      },
    },
  });

  if (!workItem) {
    return NextResponse.json({ error: "Work item not found" }, { status: 404 });
  }

  return NextResponse.json(workItem);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    title,
    summary,
    status,
    domainId,
    dueDate,
    notes,
    checklist,
  } = body as {
    title?: string;
    summary?: string;
    status?: WorkItemStatus;
    domainId?: string | null;
    dueDate?: string | null;
    notes?: string;
    checklist?: Array<{ text: string; done: boolean }>;
  };

  const existing = await prisma.workItem.findUnique({
    where: { id },
    include: { taskLinks: { where: { provider: "TODOIST" } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Work item not found" }, { status: 404 });
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await prisma.workItem.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(summary !== undefined && { summary }),
      ...(status !== undefined && { status }),
      ...(domainId !== undefined && { domainId }),
      ...(dueDate !== undefined && {
        dueDate: dueDate ? new Date(dueDate) : null,
      }),
      ...(notes !== undefined && { notes }),
      ...(checklist !== undefined && { checklist }),
    },
    include: {
      domain: { select: { id: true, name: true, color: true } },
    },
  });

  // Log status change separately; close Todoist task if marking DONE
  if (status && status !== existing.status) {
    await prisma.activityLog.create({
      data: {
        eventType: "WORK_ITEM_STATUS_CHANGED",
        workItemId: id,
        description: `Status changed: ${existing.status} → ${status}`,
        metadata: { from: existing.status, to: status },
      },
    });
    if (status === "DONE" && isConfigured()) {
      const todoistLink = existing.taskLinks?.[0];
      if (todoistLink) {
        try {
          await closeTask(todoistLink.externalId);
          await prisma.taskLink.update({
            where: { id: todoistLink.id },
            data: { externalStatus: "completed", lastSyncAt: new Date() },
          });
        } catch (err) {
          console.error("[todoist] closeTask failed:", err);
        }
      }
    }
  } else if (Object.keys(body).length > 0) {
    await prisma.activityLog.create({
      data: {
        eventType: "WORK_ITEM_UPDATED",
        workItemId: id,
        description: `Work item updated`,
        metadata: { fields: Object.keys(body) },
      },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const workItem = await prisma.workItem.findUnique({
    where: { id },
    include: { _count: { select: { threads: true } } },
  });

  if (!workItem) {
    return NextResponse.json({ error: "Work item not found" }, { status: 404 });
  }

  // Detach all threads before deletion
  await prisma.threadMirror.updateMany({
    where: { workItemId: id },
    data: { workItemId: null },
  });

  await prisma.workItem.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
