import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

import type { KanbanColumnConfig } from "@/lib/kanban";
// Re-exported so existing imports of KanbanColumnConfig from this route keep working.
export type { KanbanColumnConfig };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { columns } = body as { columns: KanbanColumnConfig[] };
  if (!Array.isArray(columns)) {
    return NextResponse.json({ error: "columns must be an array" }, { status: 400 });
  }

  const existing = await prisma.domain.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Domain not found" }, { status: 404 });

  const updated = await prisma.domain.update({
    where: { id },
    data: { kanbanColumns: columns as object[] },
  });

  return NextResponse.json(updated);
}
