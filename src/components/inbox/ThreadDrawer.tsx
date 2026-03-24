"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { EmailViewer } from "./EmailViewer";

interface ThreadDrawerProps {
  thread: { id: string; gmailThreadId: string; subject: string; isUnread?: boolean } | null;
  onClose: () => void;
}

export function ThreadDrawer({ thread, onClose }: ThreadDrawerProps) {
  // Close on Escape
  useEffect(() => {
    if (!thread) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [thread, onClose]);

  if (!thread) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Close strip */}
        <button
          onClick={onClose}
          className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 flex h-12 w-6 items-center justify-center rounded-l-md bg-white shadow-md hover:bg-slate-50"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5 text-slate-500" />
        </button>

        <div className="flex flex-1 overflow-hidden">
          <EmailViewer
            threadId={thread.id}
            gmailThreadId={thread.gmailThreadId}
            subject={thread.subject}
            isUnread={thread.isUnread}
            onStale={onClose}
          />
        </div>
      </div>
    </>
  );
}
