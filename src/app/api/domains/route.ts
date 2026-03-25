import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const domains = await prisma.domain.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          workItems: true,
          threads: true,
        },
      },
    },
  });
  return NextResponse.json(domains);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, color, description } = body as {
    name?: string;
    color?: string;
    description?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json({ error: "name must be ≤ 100 characters" }, { status: 400 });
  }
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return NextResponse.json({ error: "color must be a hex color (#rrggbb)" }, { status: 400 });
  }

  // Place new domain at the end
  const last = await prisma.domain.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const sortOrder = (last?.sortOrder ?? 0) + 1;

  const domain = await prisma.domain.create({
    data: {
      name: name.trim(),
      color: color ?? "#6366f1",
      description: description?.trim() ?? null,
      sortOrder,
    },
  });

  return NextResponse.json(domain, { status: 201 });
}
