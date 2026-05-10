"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";

interface SyncAllButtonProps {
  lastSyncAt?: string | null;
}

export function SyncAllButton({ lastSyncAt }: SyncAllButtonProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(lastSyncAt ?? null);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/accounts/sync-all", { method: "POST" });
      setTimeout(() => {
        router.refresh();
        setSyncing(false);
        setSyncedAt(new Date().toISOString());
      }, 2500);
    } catch {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {syncedAt && !syncing && (
        <span className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
          synced {relativeTime(syncedAt)}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={handleSync}
        disabled={syncing}
        title="Sync all accounts"
      >
        <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing…" : "Sync"}
      </Button>
    </div>
  );
}
