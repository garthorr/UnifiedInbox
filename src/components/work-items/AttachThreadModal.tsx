"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DomainBadge, UnassignedBadge } from "@/components/shared/DomainBadge";
import { relativeTime } from "@/lib/utils";
import { Search } from "lucide-react";

interface Thread {
  id: string;
  subject: string;
  snippet: string;
  lastMessageAt: string;
  isUnread: boolean;
  workItemId: string | null;
  account: { email: string };
  domain: { name: string; color: string } | null;
}

interface AttachThreadModalProps {
  workItemId: string;
  onClose: () => void;
}

export function AttachThreadModal({ workItemId, onClose }: AttachThreadModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ limit: "30", days: "90" });
    setLoading(true);
    fetch(`/api/threads?${params}`)
      .then((r) => r.json())
      .then((data) => setThreads(data.threads ?? []))
      .catch(() => setError("Failed to load threads"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = threads.filter((t) => {
    if (t.workItemId && t.workItemId !== workItemId) return false; // already on another WI
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      t.subject.toLowerCase().includes(q) ||
      t.snippet.toLowerCase().includes(q) ||
      t.account.email.toLowerCase().includes(q)
    );
  });

  async function attach(threadId: string) {
    setAttaching(threadId);
    setError("");
    try {
      const res = await fetch(`/api/work-items/${workItemId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to attach thread");
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach");
    } finally {
      setAttaching(null);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Attach a Thread</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search by subject, snippet, or account..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="max-h-80 overflow-y-auto -mx-2">
          {loading && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Loading threads...</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No threads found.</p>
          )}
          {filtered.map((thread) => (
            <div
              key={thread.id}
              className="flex items-start gap-3 border-b px-4 py-2.5 hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {thread.domain ? (
                    <DomainBadge name={thread.domain.name} color={thread.domain.color} />
                  ) : (
                    <UnassignedBadge />
                  )}
                  {thread.workItemId === workItemId && (
                    <span className="text-xs text-green-600 font-medium">Already attached</span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800 truncate">{thread.subject}</p>
                <p className="text-xs text-slate-500 truncate">
                  {thread.account.email} · {relativeTime(thread.lastMessageAt)}
                </p>
              </div>
              <Button
                size="sm"
                variant={thread.workItemId === workItemId ? "secondary" : "outline"}
                disabled={thread.workItemId === workItemId || attaching === thread.id}
                onClick={() => attach(thread.id)}
                className="flex-shrink-0 text-xs h-7"
              >
                {thread.workItemId === workItemId
                  ? "Attached"
                  : attaching === thread.id
                  ? "..."
                  : "Attach"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
