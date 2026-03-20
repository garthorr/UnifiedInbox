import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { WorkItemDetail } from "@/components/work-items/WorkItemDetail";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkItemPage({ params }: PageProps) {
  const { id } = await params;

  const [workItem, allDomains] = await Promise.all([
    prisma.workItem.findUnique({
      where: { id },
      include: {
        domain: { select: { id: true, name: true, color: true } },
        threads: {
          where: { isStale: false },
          orderBy: { lastMessageAt: "desc" },
          include: {
            account: { select: { id: true, email: true, displayName: true } },
          },
        },
        activityLogs: {
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { account: { select: { id: true, email: true } } },
        },
      },
    }),
    prisma.domain.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  if (!workItem) notFound();

  const backHref = workItem.domainId
    ? `/domains/${workItem.domainId}`
    : "/";

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <div className="border-b bg-white px-4 py-2 flex items-center gap-2">
          <Link href={backHref}>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <ArrowLeft className="h-3 w-3" />
              {workItem.domain?.name ?? "Inbox"}
            </Button>
          </Link>
        </div>
        <div className="flex-1 overflow-hidden">
          <WorkItemDetail
            workItem={{
              ...workItem,
              checklist: workItem.checklist as
                | Array<{ text: string; done: boolean }>
                | null,
              threads: workItem.threads.map((t) => ({
                ...t,
                lastMessageAt: t.lastMessageAt.toISOString(),
              })),
              activityLogs: workItem.activityLogs.map((log) => ({
                ...log,
                createdAt: log.createdAt.toISOString(),
                account: log.account,
              })),
              dueDate: workItem.dueDate?.toISOString() ?? null,
            }}
            allDomains={allDomains}
          />
        </div>
      </div>
    </AppShell>
  );
}
