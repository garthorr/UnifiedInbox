"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteDraft,
  loadDraft,
  replyDraftId,
  saveDraft,
  type ReplyDraft,
} from "@/lib/drafts";

interface ReplyComposeProps {
  threadId: string;
  subject: string;
  to: string;
  inReplyTo?: string | null;
  references?: string | null;
  /** Message bodies to feed the AI draft (from EmailViewer state) */
  messages?: { from: string; text: string | null; snippet: string | null }[];
  onSent: () => void;
  onCancel: () => void;
}

const AUTOSAVE_DEBOUNCE_MS = 400;

export function ReplyCompose({
  threadId,
  subject,
  to,
  inReplyTo,
  references,
  messages = [],
  onSent,
  onCancel,
}: ReplyComposeProps) {
  const draftKey = replyDraftId(threadId);
  const restored = loadDraft(draftKey) as ReplyDraft | null;

  const [body, setBody] = useState(restored?.body ?? "");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(restored?.updatedAt ?? null);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      if (!body.trim()) {
        deleteDraft(draftKey);
        setSavedAt(null);
        return;
      }
      const draft: ReplyDraft = {
        id: draftKey,
        kind: "reply",
        threadId,
        threadSubject: subject,
        to,
        subject,
        body,
        inReplyTo: inReplyTo ?? null,
        references: references ?? null,
        updatedAt: Date.now(),
      };
      saveDraft(draft);
      setSavedAt(draft.updatedAt);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [body, draftKey, inReplyTo, references, subject, threadId, to]);

  async function draftWithAi() {
    setDrafting(true);
    setError("");
    try {
      const res = await fetch("/api/ai/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          messages: messages.map((m) => ({ from: m.from, text: m.text ?? m.snippet ?? "" })),
        }),
      });
      const data = await res.json() as { draft?: string; error?: string };
      if (data.draft) setBody(data.draft);
      else setError(data.error ?? "Could not generate draft");
    } catch {
      setError("Could not reach Ollama");
    } finally {
      setDrafting(false);
    }
  }

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/threads/${threadId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body: body.trim(), inReplyTo, references }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to send");
      }
      deleteDraft(draftKey);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t bg-white">
      {/* Compose header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">To: </span>
            <span className="truncate">{to}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="font-medium text-slate-700">Subject: </span>
            {subject.startsWith("Re:") ? subject : `Re: ${subject}`}
          </p>
        </div>
        <button onClick={onCancel} className="ml-2 text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your reply…"
          className="text-sm min-h-[120px] resize-none border-0 shadow-none focus-visible:ring-0 p-0"
          autoFocus
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 pb-3">
        {error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : savedAt ? (
          <p className="text-xs text-slate-400">Draft saved · ⌘↩ to send</p>
        ) : (
          <p className="text-xs text-slate-400">⌘↩ to send</p>
        )}
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              disabled={drafting || sending}
              onClick={draftWithAi}
            >
              <Sparkles className="h-3 w-3" />
              {drafting ? "Drafting…" : "Draft with AI"}
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5"
            disabled={!body.trim() || sending}
            onClick={send}
          >
            <Send className="h-3 w-3" />
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
