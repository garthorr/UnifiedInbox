"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Two-key "g" prefix windows for vim-style navigation.
const G_PREFIX_TIMEOUT_MS = 1000;

interface Shortcut {
  keys: string;
  label: string;
}

const SHORTCUTS: { group: string; items: Shortcut[] }[] = [
  {
    group: "Navigation",
    items: [
      { keys: "g t", label: "Go to Today" },
      { keys: "g i", label: "Go to All Mail (Inbox)" },
      { keys: "g k", label: "Go to Kanban" },
      { keys: "g z", label: "Go to Snoozed" },
      { keys: "g s", label: "Go to Settings" },
      { keys: "g l", label: "Go to Sync Log" },
      { keys: "/", label: "Focus search" },
      { keys: "?", label: "Show this help" },
    ],
  },
  {
    group: "Inbox",
    items: [
      { keys: "j / ↓", label: "Next thread" },
      { keys: "k / ↑", label: "Previous thread" },
      { keys: "Enter", label: "Open first thread" },
      { keys: "Esc", label: "Close reading pane" },
      { keys: "e", label: "Archive selected thread (undoable)" },
      { keys: "# / Del", label: "Delete selected thread (undoable)" },
      { keys: "s", label: "Snooze selected thread" },
      { keys: "u", label: "Toggle read/unread" },
      { keys: "r", label: "Reply to selected thread" },
      { keys: "x", label: "Toggle checkbox on selected thread" },
      { keys: "c", label: "Compose new email" },
    ],
  },
];

function shouldIgnoreEvent(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  // Don't override OS / browser shortcuts.
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  return false;
}

export function GlobalShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let gPrefixUntil = 0;

    function onKey(e: KeyboardEvent) {
      // Help dialog is always available, even from inputs, via shift+/ (?)
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }

      if (shouldIgnoreEvent(e)) return;

      // `/` focuses any element marked as the page search input.
      if (e.key === "/") {
        const input = document.querySelector<HTMLInputElement>('[data-search="inbox"]');
        if (input) {
          e.preventDefault();
          input.focus();
          input.select();
        }
        return;
      }

      // Two-key g-prefix navigation
      const now = Date.now();
      if (e.key === "g") {
        gPrefixUntil = now + G_PREFIX_TIMEOUT_MS;
        return;
      }
      if (now < gPrefixUntil) {
        gPrefixUntil = 0;
        switch (e.key) {
          case "t": e.preventDefault(); router.push("/today"); return;
          case "i": e.preventDefault(); router.push("/"); return;
          case "k": e.preventDefault(); router.push("/kanban"); return;
          case "z": e.preventDefault(); router.push("/snoozed"); return;
          case "s": e.preventDefault(); router.push("/settings"); return;
          case "l": e.preventDefault(); router.push("/sync-log"); return;
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          {SHORTCUTS.map((group) => (
            <div key={group.group}>
              <h3
                className="font-mono text-[10px] uppercase tracking-widest mb-2"
                style={{ color: "var(--ds-muted)" }}
              >
                {group.group}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((s) => (
                  <li key={s.keys} className="flex items-center justify-between gap-3 text-[13px]">
                    <span style={{ color: "var(--ds-ink-2)" }}>{s.label}</span>
                    <kbd
                      className="font-mono text-[11px] px-1.5 py-0.5 rounded border whitespace-nowrap"
                      style={{
                        background: "var(--ds-panel-2)",
                        borderColor: "var(--ds-line)",
                        color: "var(--ds-ink)",
                      }}
                    >
                      {s.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-[11px] pt-2" style={{ color: "var(--ds-muted)" }}>
          Press <kbd className="font-mono">?</kbd> any time to toggle this list.
        </p>
      </DialogContent>
    </Dialog>
  );
}
