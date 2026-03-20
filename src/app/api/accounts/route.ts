import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      displayName: true,
      isActive: true,
      lastSyncAt: true,
      createdAt: true,
      _count: { select: { threads: true } },
    },
  });
  return NextResponse.json(accounts);
}
