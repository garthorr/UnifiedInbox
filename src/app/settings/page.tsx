import { prisma } from "@/lib/db";
import { isConfigured as todoistConfigured } from "@/lib/todoist";
import { AppShell } from "@/components/layout/AppShell";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const [accounts, todoistTaskCount] = await Promise.all([
    prisma.account.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { threads: true } },
      },
    }),
    todoistConfigured()
      ? prisma.taskLink.count({ where: { provider: "TODOIST" } })
      : Promise.resolve(0),
  ]);

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
        todoist={{ configured: todoistConfigured(), taskCount: todoistTaskCount }}
      />
    </AppShell>
  );
}
