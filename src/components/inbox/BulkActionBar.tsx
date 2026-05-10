"use client";

import { Archive, Mail, MailOpen, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  count: number;
  allCount: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onClearAll: () => void;
  onArchive: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onCreateWorkItem: () => void;
  onAssignToWorkItem: () => void;
  onDelete: () => void;
}

export function BulkActionBar({
  count,
  allCount,
  allSelected,
  onSelectAll,
  onClearAll,
  onArchive,
  onMarkRead,
  onMarkUnread,
  onCreateWorkItem,
  onAssignToWorkItem,
  onDelete,
}: BulkActionBarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100 sticky top-0 z-10">
      <input
        type="checkbox"
        checked={allSelected}
        onChange={allSelected ? onClearAll : onSelectAll}
        className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600 cursor-pointer flex-shrink-0"
        title={allSelected ? "Deselect all" : "Select all"}
      />
      <span className="text-xs font-medium text-blue-700 min-w-[60px]">
        {count} selected
      </span>

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 text-slate-600 hover:text-slate-900"
          onClick={onArchive}
          title="Archive selected"
        >
          <Archive className="h-3.5 w-3.5" />
          Archive
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 text-slate-600 hover:text-slate-900"
          onClick={onMarkRead}
          title="Mark selected as read"
        >
          <MailOpen className="h-3.5 w-3.5" />
          Read
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 text-slate-600 hover:text-slate-900"
          onClick={onMarkUnread}
          title="Mark selected as unread"
        >
          <Mail className="h-3.5 w-3.5" />
          Unread
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 text-slate-600 hover:text-slate-900"
          onClick={onCreateWorkItem}
          title={`Create work item from ${count} thread${count !== 1 ? "s" : ""}`}
        >
          <Plus className="h-3.5 w-3.5" />
          Work Item
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 text-slate-600 hover:text-slate-900"
          onClick={onAssignToWorkItem}
          title={`Assign ${count} thread${count !== 1 ? "s" : ""} to an existing work item`}
        >
          Assign
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 text-red-500 hover:text-red-700 hover:bg-red-50"
          onClick={onDelete}
          title={`Delete ${count} selected thread${count !== 1 ? "s" : ""}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 ml-auto text-slate-400 hover:text-slate-700"
        onClick={onClearAll}
        title="Clear selection"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
