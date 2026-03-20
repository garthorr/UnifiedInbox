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
          threads: { where: { isStale: false } },
        },
      },
    },
  });
  return NextResponse.json(domains);
}
