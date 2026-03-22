"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DomainBadge } from "@/components/shared/DomainBadge";
import { AttachThreadModal } from "./AttachThreadModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ExternalLink,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Calendar,
  ArrowUpRight,
  Link2Off,
  Loader2,
  FolderOpen,
  ChevronRight,
} from "lucide-react";
import { gmailThreadUrl, relativeTime, formatDate } from "@/lib/utils";
import type { WorkItemStatus } from "@prisma/client";

interface Domain {
  id: string;
  name: string;
  color: string;
}

interface Thread {
  id: string;
  gmailThreadId: string;
  subject: string;
  snippet: string;
  isUnread: boolean;
  messageCount: number;
  lastMessageAt: string | Date;
  account: { id: string; email: string };
}

interface TaskLink {
  id: string;
  provider: string;
  externalId: string;
  externalUrl: string | null;
  externalTitle: string | null;
  externalStatus: string | null;
  exportedAt: string | null;
  lastSyncAt: string | null;
}

interface ActivityLog {
  id: string;
  eventType: string;
  description: string;
  createdAt: string | Date;
  account?: { email: string } | null;
}

interface ChecklistItem {
  text: string;
  done: boolean;
}

interface WorkItem {
  id: string;
  title: string;
  summary: string | null;
  status: WorkItemStatus;
  domainId: string | null;
  dueDate: string | Date | null;
  notes: string | null;
  checklist: ChecklistItem[] | null;
  domain: Domain | null;
  threads: Thread[];
  taskLinks: TaskLink[];
  activityLogs: ActivityLog[];
}

interface WorkItemDetailProps {
  workItem: WorkItem;
  allDomains: Domain[];
  todoistEnabled: boolean;
}

const STATUSES: WorkItemStatus[] = [
  "NEW",
  "ACTIVE",
  "WAITING",
  "DELEGATED",
  "TODOIST",
  "DONE",
];

const STATUS_LABELS: Record<WorkItemStatus, string> = {
  NEW: "New",
  ACTIVE: "Active",
  WAITING: "Waiting",
  DELEGATED: "Delegated",
  TODOIST: "In Todoist",
  DONE: "Done",
};

export function WorkItemDetail({ workItem, allDomains, todoistEnabled }: WorkItemDetailProps) {
  const router = useRouter();
  const [title, setTitle] = useState(workItem.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [notes, setNotes] = useState(workItem.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    workItem.checklist ?? []
  );
  const [newCheckItem, setNewCheckItem] = useState("");
  const [status, setStatus] = useState<WorkItemStatus>(workItem.status);
  const [domainId, setDomainId] = useState(workItem.domainId ?? "");
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [detaching, setDetaching] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [todoistLoading, setTodoistLoading] = useState(false);
  const [todoistError, setTodoistError] = useState("");
  const todoistLink = workItem.taskLinks.find((tl) => tl.provider === "TODOIST") ?? null;

  // Todoist project picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string; parent_id: string | null; is_inbox_project: boolean }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
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
    if (!pickerOpen) return;
    fetchProjects();
    setSelectedProjectId("");
    setSelectedSectionId("");
    setSections([]);
    setTodoistError("");
  }, [pickerOpen, fetchProjects]);

  useEffect(() => {
    if (!selectedProjectId) { setSections([]); return; }
    setSectionsLoading(true);
    fetch(`/api/todoist/sections?projectId=${encodeURIComponent(selectedProjectId)}`)
      .then((r) => r.json())
      .then((data) => setSections(data))
      .catch(() => setSections([]))
      .finally(() => setSectionsLoading(false));
  }, [selectedProjectId]);

  async function patch(data: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/work-items/${workItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: WorkItemStatus) {
    setStatus(newStatus);
    await patch({ status: newStatus });
  }

  async function handleDomainChange(newDomainId: string) {
    const val = newDomainId === "none" ? null : newDomainId;
    setDomainId(newDomainId === "none" ? "" : newDomainId);
    await patch({ domainId: val });
  }

  async function saveTitle() {
    setEditingTitle(false);
    if (title.trim() !== workItem.title) {
      await patch({ title });
    }
  }

  async function saveNotes() {
    setEditingNotes(false);
    await patch({ notes });
  }

  async function toggleCheckItem(index: number) {
    const updated = checklist.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item
    );
    setChecklist(updated);
    await patch({ checklist: updated });
  }

  async function addCheckItem() {
    if (!newCheckItem.trim()) return;
    const updated = [...checklist, { text: newCheckItem.trim(), done: false }];
    setChecklist(updated);
    setNewCheckItem("");
    await patch({ checklist: updated });
  }

  async function removeCheckItem(index: number) {
    const updated = checklist.filter((_, i) => i !== index);
    setChecklist(updated);
    await patch({ checklist: updated });
  }

  async function detachThread(threadId: string) {
    setDetaching(threadId);
    try {
      await fetch(`/api/work-items/${workItem.id}/threads/${threadId}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setDetaching(null);
    }
  }

  async function exportToTodoist() {
    setTodoistLoading(true);
    setTodoistError("");
    try {
      const body: Record<string, string> = {};
      if (selectedProjectId) body.projectId = selectedProjectId;
      if (selectedSectionId) body.sectionId = selectedSectionId;
      const res = await fetch(`/api/work-items/${workItem.id}/todoist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Export failed");
      }
      setPickerOpen(false);
      setStatus("TODOIST");
      router.refresh();
    } catch (err) {
      setTodoistError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setTodoistLoading(false);
    }
  }

  async function unlinkTodoist() {
    setTodoistLoading(true);
    setTodoistError("");
    try {
      const res = await fetch(`/api/work-items/${workItem.id}/todoist`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Unlink failed");
      }
      router.refresh();
    } catch (err) {
      setTodoistError(err instanceof Error ? err.message : "Unlink failed");
    } finally {
      setTodoistLoading(false);
    }
  }

  const currentDomain = allDomains.find((d) => d.id === domainId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-white px-6 py-3 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === "Enter" && saveTitle()}
              className="text-base font-semibold h-8"
              autoFocus
            />
          ) : (
            <h1
              className="text-base font-semibold text-slate-900 cursor-pointer hover:text-blue-600 truncate"
              onClick={() => setEditingTitle(true)}
              title="Click to edit title"
            >
              {title}
            </h1>
          )}
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            {/* Status selector */}
            <Select value={status} onValueChange={(v) => handleStatusChange(v as WorkItemStatus)}>
              <SelectTrigger className="h-6 w-auto text-xs border-0 p-0 shadow-none gap-1 focus:ring-0">
                <StatusBadge status={status} />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Domain selector */}
            <Select
              value={domainId || "none"}
              onValueChange={handleDomainChange}
            >
              <SelectTrigger className="h-6 w-auto text-xs border-0 p-0 shadow-none gap-1 focus:ring-0">
                {currentDomain ? (
                  <DomainBadge name={currentDomain.name} color={currentDomain.color} />
                ) : (
                  <span className="text-xs text-slate-400">No domain</span>
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">No domain</SelectItem>
                {allDomains.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {workItem.dueDate && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <Calendar className="h-3 w-3" />
                Due {formatDate(workItem.dueDate)}
              </span>
            )}

            {saving && <span className="text-xs text-slate-400">Saving...</span>}
          </div>
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: summary, notes, checklist */}
        <div className="w-[360px] flex-shrink-0 border-r overflow-y-auto px-5 py-4 space-y-5">
          {/* Notes */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5 block">
              Notes
            </Label>
            {editingNotes ? (
              <div className="space-y-1.5">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm min-h-[120px] resize-none"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-6 text-xs" onClick={saveNotes}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => {
                      setNotes(workItem.notes ?? "");
                      setEditingNotes(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="min-h-[60px] cursor-pointer rounded-md border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setEditingNotes(true)}
              >
                {notes || (
                  <span className="text-slate-400">Add notes... (click to edit)</span>
                )}
              </div>
            )}
          </div>

          {/* Todoist */}
          {todoistEnabled && (
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5 block">
                Todoist
              </Label>
              {todoistLink ? (
                <div className="rounded-md border bg-white px-3 py-2.5 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <a
                        href={todoistLink.externalUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-slate-800 hover:text-blue-600 flex items-center gap-1 truncate"
                      >
                        {todoistLink.externalTitle}
                        <ArrowUpRight className="h-3 w-3 flex-shrink-0" />
                      </a>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {todoistLink.externalStatus === "completed"
                          ? "Completed in Todoist"
                          : todoistLink.lastSyncAt
                          ? `Synced ${relativeTime(todoistLink.lastSyncAt)}`
                          : "Syncing..."}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-slate-400 hover:text-red-500 flex-shrink-0"
                      disabled={todoistLoading}
                      onClick={unlinkTodoist}
                      title="Remove Todoist link"
                    >
                      <Link2Off className="h-3 w-3" />
                    </Button>
                  </div>
                  {todoistError && (
                    <p className="text-xs text-red-500">{todoistError}</p>
                  )}
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 w-full justify-start"
                    onClick={() => setPickerOpen(true)}
                  >
                    <ArrowUpRight className="h-3 w-3" />
                    Export to Todoist
                  </Button>

                  <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Export to Todoist</DialogTitle>
                      </DialogHeader>

                      {/* Project list */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-500 mb-2">Select project</p>
                        {projectsLoading ? (
                          <div className="flex items-center gap-2 text-xs text-slate-400 py-4 justify-center">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading projects…
                          </div>
                        ) : projects.length === 0 ? (
                          <div className="rounded-md border px-3 py-4 text-center">
                            <p className="text-xs text-slate-400">
                              {todoistError ? todoistError : "No projects found"}
                            </p>
                            <button
                              className="mt-2 text-xs text-blue-500 hover:underline"
                              onClick={() => { setTodoistError(""); fetchProjects(); }}
                            >
                              Retry
                            </button>
                          </div>
                        ) : (
                          <div className="max-h-52 overflow-y-auto rounded-md border divide-y">
                            {projects.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setSelectedProjectId(p.id);
                                  setSelectedSectionId("");
                                }}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                                  selectedProjectId === p.id
                                    ? "bg-blue-50 text-blue-700 font-medium"
                                    : "text-slate-700"
                                } ${p.parent_id ? "pl-7 text-xs" : ""}`}
                              >
                                <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                                <span className="truncate">{p.name}</span>
                                {p.is_inbox_project && (
                                  <span className="ml-auto text-[10px] text-slate-400">Inbox</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Section list — shown only when a project is selected */}
                      {selectedProjectId && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-slate-500 mb-2">
                            Section <span className="font-normal text-slate-400">(optional)</span>
                          </p>
                          {sectionsLoading ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400 py-2 justify-center">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading sections…
                            </div>
                          ) : sections.length === 0 ? (
                            <p className="text-xs text-slate-400 py-1">No sections in this project</p>
                          ) : (
                            <div className="max-h-36 overflow-y-auto rounded-md border divide-y">
                              <button
                                onClick={() => setSelectedSectionId("")}
                                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                                  !selectedSectionId ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-500"
                                }`}
                              >
                                — No section
                              </button>
                              {sections.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => setSelectedSectionId(s.id)}
                                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                                    selectedSectionId === s.id
                                      ? "bg-blue-50 text-blue-700 font-medium"
                                      : "text-slate-700"
                                  }`}
                                >
                                  <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-50" />
                                  <span className="truncate">{s.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {todoistError && projects.length > 0 && (
                        <p className="text-xs text-red-500">{todoistError}</p>
                      )}

                      <DialogFooter>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPickerOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={!selectedProjectId || todoistLoading}
                          onClick={exportToTodoist}
                        >
                          {todoistLoading ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Exporting…</>
                          ) : "Export"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          )}

          {/* Checklist */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5 block">
              Checklist
            </Label>
            <div className="space-y-1">
              {checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <button
                    onClick={() => toggleCheckItem(i)}
                    className="flex-shrink-0 text-slate-400 hover:text-slate-700"
                  >
                    {item.done ? (
                      <CheckSquare className="h-4 w-4 text-green-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                  <span
                    className={`flex-1 text-sm ${
                      item.done ? "line-through text-slate-400" : "text-slate-700"
                    }`}
                  >
                    {item.text}
                  </span>
                  <button
                    onClick={() => removeCheckItem(i)}
                    className="hidden group-hover:block text-slate-300 hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <Input
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCheckItem()}
                placeholder="Add item..."
                className="h-7 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2"
                onClick={addCheckItem}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right: threads, activity log */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Threads */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Threads ({workItem.threads.length})
              </Label>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={() => setShowAttachModal(true)}
              >
                <Plus className="h-3 w-3" />
                Attach a Thread
              </Button>
            </div>

            {workItem.threads.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No threads attached yet.</p>
            ) : (
              <div className="space-y-2">
                {workItem.threads.map((thread) => (
                  <div
                    key={thread.id}
                    className="rounded-lg border bg-white px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      {thread.isUnread && (
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {thread.subject}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {thread.account.email} · {thread.messageCount} msg
                          {thread.messageCount !== 1 ? "s" : ""} ·{" "}
                          {relativeTime(thread.lastMessageAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a
                          href={gmailThreadUrl(thread.gmailThreadId)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                            <ExternalLink className="h-3 w-3" />
                            Gmail
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-slate-400 hover:text-red-500"
                          disabled={detaching === thread.id}
                          onClick={() => detachThread(thread.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity log */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 block">
              Activity Log
            </Label>
            {workItem.activityLogs.length === 0 ? (
              <p className="text-xs text-slate-400">No activity yet.</p>
            ) : (
              <div className="space-y-1">
                {workItem.activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-xs">
                    <span className="text-slate-400 flex-shrink-0 tabular-nums">
                      {relativeTime(log.createdAt)}
                    </span>
                    <span className="text-slate-600">{log.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAttachModal && (
        <AttachThreadModal
          workItemId={workItem.id}
          onClose={() => setShowAttachModal(false)}
        />
      )}
    </div>
  );
}
