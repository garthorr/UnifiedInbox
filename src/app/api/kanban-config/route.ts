import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveKanbanColumns, type KanbanColumnConfig } from "@/lib/kanban";

// Global Kanban board configuration. Stored as a single "singleton" row so the
// /kanban board's columns can be customized the same way per-domain boards are.

export async function GET() {
  const row = await prisma.kanbanSetting.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({ columns: resolveKanbanColumns(row?.columns ?? null) });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { columns } = body as { columns: KanbanColumnConfig[] };
  if (!Array.isArray(columns)) {
    return NextResponse.json({ error: "columns must be an array" }, { status: 400 });
  }

  const row = await prisma.kanbanSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", columns: columns as object[] },
    update: { columns: columns as object[] },
  });

  return NextResponse.json({ columns: resolveKanbanColumns(row.columns) });
}
