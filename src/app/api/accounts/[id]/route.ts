import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Log disconnection before deletion (cascade will remove the account)
  await prisma.activityLog.create({
    data: {
      eventType: "ACCOUNT_DISCONNECTED",
      accountId: id,
      description: `Account removed: ${account.email}`,
    },
  });

  // Set accountId to null on activity logs (via SetNull in schema)
  // then delete the account (cascades to threads)
  await prisma.account.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
