import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncAccount } from "@/lib/gmail/sync";

export async function POST() {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  // Fire-and-forget all active accounts in parallel
  for (const account of accounts) {
    syncAccount(account.id).catch((err) => {
      console.error(`Sync failed for account ${account.id}:`, err);
    });
  }

  return NextResponse.json({ ok: true, count: accounts.length });
}
