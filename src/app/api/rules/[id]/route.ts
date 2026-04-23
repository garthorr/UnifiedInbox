import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const rule = await prisma.rule.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.conditions !== undefined && { conditions: body.conditions }),
      ...(body.action !== undefined && { action: body.action }),
      ...(body.domainId !== undefined && { domainId: body.domainId }),
    },
    include: { domain: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(rule);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.rule.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
