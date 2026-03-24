"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ReplyComposeProps {
  threadId: string;
  subject: string;
  to: string;            // pre-filled recipient (original sender)
  inReplyTo?: string | null;
  references?: string | null;
  onSent: () => void;
  onCancel: () => void;
}

export function ReplyCompose({
  threadId,
  subject,
  to,
  inReplyTo,
  references,
  onSent,
  onCancel,
}: ReplyComposeProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

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
        ) : (
          <p className="text-xs text-slate-400">⌘↩ to send</p>
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
  );
}
