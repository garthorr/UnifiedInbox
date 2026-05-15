"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SnoozePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (until: Date) => void;
}

interface Preset {
  label: string;
  hint: string;
  at: () => Date;
}

function setHour(date: Date, hour: number): Date {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Day-of-week deltas for "this weekend" (Saturday) and "next week" (next Monday).
function nextWeekday(target: number): Date {
  const now = new Date();
  const cur = now.getDay();
  let delta = (target - cur + 7) % 7;
  if (delta === 0) delta = 7;
  return setHour(addDays(now, delta), 8);
}

const PRESETS: Preset[] = [
  {
    label: "Later today",
    hint: "+3 hours",
    at: () => new Date(Date.now() + 3 * 60 * 60 * 1000),
  },
  {
    label: "Tomorrow morning",
    hint: "8:00 AM",
    at: () => setHour(addDays(new Date(), 1), 8),
  },
  {
    label: "This weekend",
    hint: "Saturday 8 AM",
    at: () => nextWeekday(6),
  },
  {
    label: "Next week",
    hint: "Monday 8 AM",
    at: () => nextWeekday(1),
  },
];

function toLocalInputValue(d: Date): string {
  // Strip seconds + timezone for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SnoozePicker({ open, onClose, onSelect }: SnoozePickerProps) {
  const defaultCustom = useMemo(() => toLocalInputValue(addDays(new Date(), 1)), []);
  const [custom, setCustom] = useState(defaultCustom);

  function commit(d: Date) {
    if (d.getTime() <= Date.now()) return;
    onSelect(d);
    onClose();
  }

  function commitCustom() {
    const d = new Date(custom);
    if (Number.isNaN(d.getTime())) return;
    commit(d);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Snooze until…</DialogTitle>
          <DialogDescription>
            Pick a preset or a custom date to hide this thread until it&apos;s due.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => commit(p.at())}
              className="rounded-md border p-3 text-left transition-colors hover:bg-black/5"
              style={{ borderColor: "var(--ds-line)" }}
            >
              <div className="text-[13px] font-semibold" style={{ color: "var(--ds-ink)" }}>
                {p.label}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--ds-muted)" }}>
                {p.hint}
              </div>
            </button>
          ))}
        </div>
        <div className="border-t pt-3 mt-1" style={{ borderColor: "var(--ds-line)" }}>
          <label
            htmlFor="snooze-custom"
            className="block text-[11px] font-medium mb-1.5 font-mono uppercase tracking-widest"
            style={{ color: "var(--ds-muted)" }}
          >
            Custom date & time
          </label>
          <div className="flex items-center gap-2">
            <input
              id="snooze-custom"
              type="datetime-local"
              value={custom}
              min={toLocalInputValue(new Date())}
              onChange={(e) => setCustom(e.target.value)}
              className="flex-1 rounded-md border px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2"
              style={{
                background: "var(--ds-panel-2)",
                borderColor: "var(--ds-line)",
                color: "var(--ds-ink)",
              }}
            />
            <Button onClick={commitCustom} size="sm">Snooze</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
