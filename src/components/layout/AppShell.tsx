import { prisma } from "@/lib/db";
import { DomainSidebar } from "./DomainSidebar";

async function getSidebarData() {
  const [domains, counts] = await Promise.all([
    prisma.domain.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.workItem.groupBy({
      by: ["status"],
      where: { status: { in: ["ACTIVE", "WAITING", "DELEGATED"] } },
      _count: true,
    }),
  ]);

  const countMap = { active: 0, waiting: 0, delegated: 0 };
  for (const c of counts) {
    if (c.status === "ACTIVE") countMap.active = c._count;
    if (c.status === "WAITING") countMap.waiting = c._count;
    if (c.status === "DELEGATED") countMap.delegated = c._count;
  }

  return { domains, counts: countMap };
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { domains, counts } = await getSidebarData();

  return (
    <div className="flex h-screen overflow-hidden">
      <DomainSidebar domains={domains} counts={counts} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
