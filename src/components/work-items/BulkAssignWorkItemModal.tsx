"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface WorkItem {
  id: string;
  title: string;
  status: string;
  _count?: { threads: number };
}

interface BulkAssignWorkItemModalProps {
  threadIds: string[];
  onClose: () => void;
}

export function BulkAssignWorkItemModal({ threadIds, onClose }: BulkAssignWorkItemModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/work-items?excludeDone=true&limit=100")
      .then((r) => r.json())
      .then((data) => setWorkItems(data.workItems ?? []))
      .catch(() => setError("Failed to load work items"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query) return workItems;
    const q = query.toLowerCase();
    return workItems.filter((w) => w.title.toLowerCase().includes(q));
  }, [query, workItems]);

  async function assign(workItemId: string) {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/work-items/assign-threads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workItemId, threadIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to assign threads");
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign threads");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign {threadIds.length} selected thread{threadIds.length !== 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>
            Pick an existing work item to attach the selected thread{threadIds.length !== 1 ? "s" : ""} to.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search work items..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
          {loading && <p className="p-4 text-sm text-slate-400">Loading work items...</p>}
          {!loading && filtered.length === 0 && <p className="p-4 text-sm text-slate-400">No work items found.</p>}
          {filtered.map((item) => (
            <div key={item.id} className="p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                <p className="text-xs text-slate-500">{item.status} · {item._count?.threads ?? 0} threads</p>
              </div>
              <Button size="sm" disabled={submitting} onClick={() => assign(item.id)}>
                Assign
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
