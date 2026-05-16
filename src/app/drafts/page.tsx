export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { DraftsClient } from "./DraftsClient";

export default async function DraftsPage() {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true, email: true, displayName: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <AppShell>
      <DraftsClient accounts={accounts} />
    </AppShell>
  );
}
