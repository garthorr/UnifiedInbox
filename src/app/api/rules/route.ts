import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const rules = await prisma.rule.findMany({
    orderBy: { priority: "asc" },
    include: { domain: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.name || !body.action || !Array.isArray(body.conditions)) {
    return NextResponse.json({ error: "name, action, and conditions are required" }, { status: 400 });
  }

  const rule = await prisma.rule.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      isActive: body.isActive ?? true,
      priority: body.priority ?? 100,
      conditions: body.conditions,
      action: body.action,
      domainId: body.domainId ?? null,
    },
    include: { domain: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(rule, { status: 201 });
}
