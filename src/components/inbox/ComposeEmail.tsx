"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface Account {
  id: string;
  email: string;
  displayName: string;
}

interface ComposeEmailProps {
  accounts: Account[];
  defaultAccountId?: string;
  onClose: () => void;
}

export function ComposeEmail({ accounts, defaultAccountId, onClose }: ComposeEmailProps) {
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? "");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function send() {
    if (!to.trim() || !body.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, to: to.trim(), subject: subject.trim(), body: body.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to send");
      }
      setSent(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 w-[480px] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white rounded-t-xl">
        <span className="text-sm font-medium">New Message</span>
        <button onClick={onClose} className="text-slate-300 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Fields */}
      <div className="divide-y border-b">
        {accounts.length > 1 && (
          <div className="flex items-center px-4 py-1.5 gap-2">
            <span className="text-xs text-slate-500 w-14 flex-shrink-0">From</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="flex-1 text-sm bg-transparent focus:outline-none text-slate-800"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName ? `${a.displayName} <${a.email}>` : a.email}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center px-4 py-1.5 gap-2">
          <span className="text-xs text-slate-500 w-14 flex-shrink-0">To</span>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1 text-sm border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
            autoFocus
          />
        </div>
        <div className="flex items-center px-4 py-1.5 gap-2">
          <span className="text-xs text-slate-500 w-14 flex-shrink-0">Subject</span>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="(no subject)"
            className="flex-1 text-sm border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
          />
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-2 flex-1">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message…"
          className="text-sm min-h-[160px] resize-none border-0 shadow-none focus-visible:ring-0 p-0"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 pb-3">
        {sent ? (
          <p className="text-xs text-green-600 font-medium">Sent!</p>
        ) : error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : (
          <p className="text-xs text-slate-400">⌘↩ to send</p>
        )}
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5"
          disabled={!to.trim() || !body.trim() || sending || sent}
          onClick={send}
        >
          <Send className="h-3 w-3" />
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
