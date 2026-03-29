import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncAccount } from "@/lib/gmail/sync";

const CONCURRENCY = 3;

async function runWithConcurrency(
  ids: string[],
  limit: number
): Promise<void> {
  for (let i = 0; i < ids.length; i += limit) {
    await Promise.all(
      ids.slice(i, i + limit).map((id) =>
        syncAccount(id).catch((err) => {
          console.error(`Sync failed for account ${id}:`, err);
        })
      )
    );
  }
}

export async function POST() {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  // Run in background with a concurrency cap to avoid exhausting the DB pool
  runWithConcurrency(
    accounts.map((a) => a.id),
    CONCURRENCY
  ).catch((err) => console.error("[sync-all] error:", err));

  return NextResponse.json({ ok: true, count: accounts.length });
}
