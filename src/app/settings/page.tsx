import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { threads: true } },
    },
  });

  return (
    <AppShell>
      <SettingsClient
        accounts={accounts.map((a) => ({
          id: a.id,
          email: a.email,
          displayName: a.displayName,
          isActive: a.isActive,
          lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
          threadCount: a._count.threads,
        }))}
      />
    </AppShell>
  );
}
