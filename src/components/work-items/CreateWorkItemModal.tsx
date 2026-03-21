"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Domain {
  id: string;
  name: string;
  color: string;
}

interface CreateWorkItemModalProps {
  thread?: {
    id: string;
    subject: string;
    domain?: { id: string; name: string; color: string } | null;
  };
  initialDomainId?: string;
  domains?: Domain[];
  onClose: () => void;
}

export function CreateWorkItemModal({
  thread,
  initialDomainId,
  domains: propDomains,
  onClose,
}: CreateWorkItemModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState(thread?.subject ?? "");
  const [domainId, setDomainId] = useState(
    initialDomainId ?? thread?.domain?.id ?? ""
  );
  const [domains, setDomains] = useState<Domain[]>(propDomains ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load domains if not provided
  useState(() => {
    if (!propDomains) {
      fetch("/api/domains")
        .then((r) => r.json())
        .then((data) => setDomains(data))
        .catch(() => {});
    }
  });

  async function handleCreate() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/work-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          domainId: domainId || undefined,
          threadId: thread?.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create work item");
      }
      const workItem = await res.json();
      onClose();
      router.push(`/work-items/${workItem.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create work item");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Work Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Spring Banquet 2026"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="domain">Domain</Label>
            <Select value={domainId} onValueChange={setDomainId}>
              <SelectTrigger id="domain">
                <SelectValue placeholder="Select a domain (optional)" />
              </SelectTrigger>
              <SelectContent>
                {domains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {thread && (
            <p className="text-xs text-slate-500">
              Thread will be attached: <span className="font-medium">{thread.subject}</span>
            </p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create Work Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
