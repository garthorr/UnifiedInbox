import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, color, description, sortOrder, isActive } = body as {
    name?: string;
    color?: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
  };

  if (name !== undefined && !name.trim()) {
    return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
  }
  if (name && name.length > 100) {
    return NextResponse.json({ error: "name must be ≤ 100 characters" }, { status: 400 });
  }
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return NextResponse.json({ error: "color must be a hex color (#rrggbb)" }, { status: 400 });
  }

  const existing = await prisma.domain.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Domain not found" }, { status: 404 });

  const updated = await prisma.domain.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(color !== undefined && { color }),
      ...(description !== undefined && { description: description.trim() || null }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = await prisma.domain.findUnique({
    where: { id },
    include: { _count: { select: { workItems: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Domain not found" }, { status: 404 });

  if (existing._count.workItems > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${existing._count.workItems} work item(s) are assigned to this domain. Reassign or delete them first.` },
      { status: 409 }
    );
  }

  // Clear domainId on any threads still pointing here
  await prisma.threadMirror.updateMany({ where: { domainId: id }, data: { domainId: null } });
  await prisma.domain.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
