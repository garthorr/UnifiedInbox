"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface AiTaskBarProps {
  threadId: string;
  subject: string;
  snippet: string;
  from: string;
  todoistEnabled?: boolean;
  onCreateTask?: (title: string) => void;
}

interface Suggestion {
  title: string;
  dueDate: string | null;
  description: string;
}

export function AiTaskBar({ threadId, subject, snippet, from, todoistEnabled, onCreateTask }: AiTaskBarProps) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const fetchedFor = useRef<string>("");

  useEffect(() => {
    if (fetchedFor.current === threadId) return;
    fetchedFor.current = threadId;
    setSuggestion(null);
    setExpanded(false);
    setDismissed(false);
    setError("");
    setLoading(true);

    fetch("/api/ai/suggest-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, snippet, from }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        const s: Suggestion = { title: data.title, dueDate: data.dueDate, description: data.description };
        setSuggestion(s);
        setTitle(s.title);
        setDueDate(s.dueDate ?? "");
        setDescription(s.description ?? "");
      })
      .catch(() => setError("Could not reach Ollama"))
      .finally(() => setLoading(false));
  }, [threadId, subject, snippet, from]);

  if (dismissed) return null;
  if (error) return null; // silently hide if Ollama not available

  return (
    <div
      className="absolute left-5 right-5 bottom-[18px] rounded-[10px] transition-all"
      style={{
        background: "var(--ds-ink)",
        boxShadow: "0 10px 30px -8px color-mix(in oklch, var(--ds-ink) 35%, transparent)",
        padding: expanded ? "18px 20px 20px" : "14px 16px",
        color: "var(--ds-panel)",
      }}
    >
      {/* Collapsed / header row */}
      <div className="flex items-center gap-3">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.1em] rounded-[3px] px-2 py-0.5 flex-shrink-0"
          style={{ background: "color-mix(in oklch, var(--ds-panel) 22%, transparent)", color: "color-mix(in oklch, var(--ds-panel) 85%, transparent)" }}
        >
          AI draft
        </span>

        {loading ? (
          <div className="flex items-center gap-2 flex-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin opacity-60" />
            <span className="text-[13px] opacity-50">Analyzing email…</span>
          </div>
        ) : (
          <input
            className="flex-1 bg-transparent border-none outline-none text-[15px] font-semibold tracking-tight"
            style={{ color: "var(--ds-panel)" }}
            placeholder={subject}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {!loading && suggestion && (
          <button
            className="flex-shrink-0 flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-[11.5px] font-medium transition-colors"
            style={{
              background: "color-mix(in oklch, var(--ds-panel) 15%, transparent)",
              color: "var(--ds-panel)",
            }}
            onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}
          >
            {expanded ? "Collapse ↑" : "Review & send →"}
          </button>
        )}

        <button
          className="flex-shrink-0 opacity-40 hover:opacity-70 text-[16px] leading-none"
          style={{ color: "var(--ds-panel)" }}
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
          title="Dismiss"
        >
          ×
        </button>
      </div>

      {/* Expanded body */}
      {expanded && suggestion && (
        <div
          className="mt-[14px] pt-[14px] grid gap-[14px]"
          style={{
            gridTemplateColumns: "1fr 1fr",
            borderTop: "1px solid color-mix(in oklch, var(--ds-panel) 15%, transparent)",
          }}
        >
          {/* Description */}
          <div className="col-span-2 space-y-1.5">
            <label
              className="font-mono text-[9.5px] uppercase tracking-[0.1em]"
              style={{ color: "color-mix(in oklch, var(--ds-panel) 60%, transparent)" }}
            >
              Description
            </label>
            <input
              className="w-full rounded-[5px] border text-[13px] px-2.5 py-1.5 bg-transparent"
              style={{
                background: "color-mix(in oklch, var(--ds-panel) 10%, transparent)",
                borderColor: "color-mix(in oklch, var(--ds-panel) 15%, transparent)",
                color: "var(--ds-panel)",
              }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description…"
            />
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <label
              className="font-mono text-[9.5px] uppercase tracking-[0.1em]"
              style={{ color: "color-mix(in oklch, var(--ds-panel) 60%, transparent)" }}
            >
              Due date
            </label>
            <input
              type="date"
              className="w-full rounded-[5px] border text-[13px] px-2.5 py-1.5"
              style={{
                background: "color-mix(in oklch, var(--ds-panel) 10%, transparent)",
                borderColor: "color-mix(in oklch, var(--ds-panel) 15%, transparent)",
                color: "var(--ds-panel)",
              }}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* AI hint */}
          <div className="flex items-end pb-1">
            <div
              className="flex items-center gap-2 font-mono text-[11px]"
              style={{ color: "color-mix(in oklch, var(--ds-panel) 70%, transparent)" }}
            >
              <span
                className="w-[14px] h-[14px] rounded-[3px] grid place-items-center text-white font-bold text-[10px] flex-shrink-0"
                style={{ background: "var(--ds-hot)" }}
              >
                ✦
              </span>
              Suggested by Ollama
            </div>
          </div>

          {/* Action row */}
          <div className="col-span-2 flex items-center justify-between pt-1">
            <div />
            <div className="flex items-center gap-2">
              <button
                className="text-[12px] font-semibold px-3 py-1.5 rounded-[5px] transition-colors"
                style={{ color: "color-mix(in oklch, var(--ds-panel) 75%, transparent)" }}
                onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
              >
                Dismiss
              </button>
              <button
                className="text-[12px] font-semibold px-3 py-1.5 rounded-[5px] text-white transition-colors"
                style={{ background: "var(--ds-hot)" }}
                onClick={(e) => { e.stopPropagation(); onCreateTask?.(title); }}
              >
                Create Work Item ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
