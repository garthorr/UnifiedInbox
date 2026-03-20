import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { formatDateTime } from "@/lib/utils";
import { CheckCircle, XCircle, Info } from "lucide-react";
import type { ActivityEventType } from "@prisma/client";

const SYNC_EVENT_TYPES: ActivityEventType[] = [
  "ACCOUNT_CONNECTED",
  "ACCOUNT_SYNC_STARTED",
  "ACCOUNT_SYNC_COMPLETED",
  "ACCOUNT_SYNC_FAILED",
  "THREAD_IMPORTED",
  "THREAD_STALE",
];

function EventIcon({ type }: { type: ActivityEventType }) {
  if (type.includes("FAILED")) {
    return <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />;
  }
  if (type.includes("COMPLETED") || type.includes("CONNECTED")) {
    return <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />;
  }
  return <Info className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />;
}

export default async function SyncLogPage() {
  const entries = await prisma.activityLog.findMany({
    where: { eventType: { in: SYNC_EVENT_TYPES } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      account: { select: { id: true, email: true } },
    },
  });

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <div className="border-b bg-white px-6 py-3">
          <h1 className="text-base font-semibold text-slate-900">Sync Log</h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">
              No sync activity yet. Connect a Gmail account to get started.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-500 w-[160px]">
                    Time
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500 w-8" />
                  <th className="px-4 py-2 text-left font-medium text-slate-500 w-[200px]">
                    Account
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500 w-[180px]">
                    Event
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-400 tabular-nums whitespace-nowrap">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-2 py-2">
                      <EventIcon type={entry.eventType} />
                    </td>
                    <td className="px-4 py-2 text-slate-500 truncate max-w-[200px]">
                      {entry.account?.email ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500 font-mono">
                      {entry.eventType}
                    </td>
                    <td className="px-4 py-2 text-slate-600 max-w-[400px] truncate">
                      {entry.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
