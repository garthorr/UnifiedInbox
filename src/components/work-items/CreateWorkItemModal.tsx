"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Loader2, FolderOpen } from "lucide-react";

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
  threads?: { id: string; subject: string }[];
  initialDomainId?: string;
  domains?: Domain[];
  todoistEnabled?: boolean;
  onClose: () => void;
}

export function CreateWorkItemModal({
  thread,
  threads,
  initialDomainId,
  domains: propDomains,
  todoistEnabled = false,
  onClose,
}: CreateWorkItemModalProps) {
  const router = useRouter();
  const isMulti = !!threads?.length;
  const [title, setTitle] = useState(isMulti ? "" : (thread?.subject ?? ""));
  const [domainId, setDomainId] = useState(
    initialDomainId ?? thread?.domain?.id ?? ""
  );
  const [domains, setDomains] = useState<Domain[]>(propDomains ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Todoist state
  const [sendToTodoist, setSendToTodoist] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string; parent_id: string | null; is_inbox_project: boolean }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [todoistError, setTodoistError] = useState("");

  // Load domains if not provided
  useState(() => {
    if (!propDomains) {
      fetch("/api/domains")
        .then((r) => r.json())
        .then((data) => setDomains(data))
        .catch(() => {});
    }
  });

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    setTodoistError("");
    try {
      const res = await fetch("/api/todoist/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      setProjects(await res.json());
    } catch {
      setTodoistError("Could not load Todoist projects");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sendToTodoist || projects.length > 0) return;
    fetchProjects();
  }, [sendToTodoist, projects.length, fetchProjects]);

  useEffect(() => {
    if (!selectedProjectId) { setSections([]); return; }
    setSectionsLoading(true);
    fetch(`/api/todoist/sections?projectId=${encodeURIComponent(selectedProjectId)}`)
      .then((r) => r.json())
      .then((data) => setSections(data))
      .catch(() => setSections([]))
      .finally(() => setSectionsLoading(false));
  }, [selectedProjectId]);

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
          ...(isMulti
            ? { threadIds: threads!.map((t) => t.id) }
            : { threadId: thread?.id }),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create work item");
      }
      const workItem = await res.json();

      // Optionally export to Todoist
      if (sendToTodoist && selectedProjectId) {
        const body: Record<string, string> = { projectId: selectedProjectId };
        if (selectedSectionId) body.sectionId = selectedSectionId;
        if (dueDate) body.dueDate = dueDate;
        await fetch(`/api/work-items/${workItem.id}/todoist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        // Proceed to work item even if Todoist export fails
      }

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
              onKeyDown={(e) => e.key === "Enter" && !sendToTodoist && handleCreate()}
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

          {/* Todoist */}
          {todoistEnabled && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600"
                  checked={sendToTodoist}
                  onChange={(e) => setSendToTodoist(e.target.checked)}
                />
                <span className="text-sm text-slate-700">Also add to Todoist</span>
              </label>

              {sendToTodoist && (
                <div className="space-y-2 pl-5">
                  {/* Project picker */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">Project</p>
                    {projectsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 py-3 justify-center rounded-md border">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading…
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="rounded-md border px-3 py-3 text-center">
                        <p className="text-xs text-slate-400">
                          {todoistError || "No projects found"}
                        </p>
                        <button
                          className="mt-1 text-xs text-blue-500 hover:underline"
                          onClick={() => fetchProjects()}
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                        {projects.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedProjectId(p.id);
                              setSelectedSectionId("");
                            }}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                              selectedProjectId === p.id
                                ? "bg-blue-50 text-blue-700 font-medium"
                                : "text-slate-700"
                            } ${p.parent_id ? "pl-6 text-xs" : ""}`}
                          >
                            <FolderOpen className="h-3 w-3 flex-shrink-0 opacity-60" />
                            <span className="truncate">{p.name}</span>
                            {p.is_inbox_project && (
                              <span className="ml-auto text-[10px] text-slate-400">Inbox</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section picker */}
                  {selectedProjectId && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500">
                        Section <span className="font-normal text-slate-400">(optional)</span>
                      </p>
                      {sectionsLoading ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-2 justify-center">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading sections…
                        </div>
                      ) : sections.length === 0 ? (
                        <p className="text-xs text-slate-400">No sections in this project</p>
                      ) : (
                        <Select
                          value={selectedSectionId}
                          onValueChange={setSelectedSectionId}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="No section" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No section</SelectItem>
                            {sections.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {/* Due date */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">
                      Due date <span className="font-normal text-slate-400">(optional)</span>
                    </p>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {sendToTodoist && !selectedProjectId && projects.length > 0 && (
                    <p className="text-xs text-amber-600">Select a project to add to Todoist</p>
                  )}
                </div>
              )}
            </div>
          )}

          {isMulti ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 space-y-1">
              <p className="text-xs font-medium text-slate-600">
                {threads!.length} thread{threads!.length !== 1 ? "s" : ""} will be attached:
              </p>
              <ul className="space-y-0.5">
                {threads!.slice(0, 5).map((t) => (
                  <li key={t.id} className="text-xs text-slate-500 truncate">· {t.subject}</li>
                ))}
                {threads!.length > 5 && (
                  <li className="text-xs text-slate-400">· and {threads!.length - 5} more…</li>
                )}
              </ul>
            </div>
          ) : thread ? (
            <p className="text-xs text-slate-500">
              Thread will be attached: <span className="font-medium">{thread.subject}</span>
            </p>
          ) : null}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading || (sendToTodoist && !selectedProjectId && projects.length > 0)}
          >
            {loading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Creating…</>
            ) : "Create Work Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
