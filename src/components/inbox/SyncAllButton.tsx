"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncAllButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/accounts/sync-all", { method: "POST" });
      // Give the background sync a moment then refresh
      setTimeout(() => {
        router.refresh();
        setSyncing(false);
      }, 2500);
    } catch {
      setSyncing(false);
    }
  }

  return (
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
  );
}
