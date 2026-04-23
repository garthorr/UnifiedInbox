"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { messageCache } from "@/lib/client-message-cache";
import {
  Loader2, ExternalLink, ChevronDown, ChevronUp,
  ArchiveIcon, Trash2, Mail, MailOpen, Reply, Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReplyCompose } from "./ReplyCompose";
import { AiTaskBar } from "./AiTaskBar";
import { CreateWorkItemModal } from "@/components/work-items/CreateWorkItemModal";
import { gmailThreadUrl } from "@/lib/utils";

export function invalidateThreadCache(threadId: string) {
  messageCache.delete(threadId);
}

interface Message {
  id: string;
  messageId: string | null;
  from: string;
  to: string;
  replyTo: string | null;
  references: string | null;
  date: string;
  snippet: string | null;
  html: string | null;
  text: string | null;
  bodyLoaded: boolean;
  attachments: { id: string; filename: string; mimeType: string; size: number }[];
}

interface EmailViewerProps {
  threadId: string;
  gmailThreadId: string;
  subject: string;
  snippet?: string;
  isUnread?: boolean;
  todoistEnabled?: boolean;
  /** Called after archive/trash so the parent can remove the thread from view */
  onStale?: () => void;
  /** Called when read/unread state changes */
  onUnreadChange?: (isUnread: boolean) => void;
}

function MessageFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function handleLoad() {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    const h = iframe.contentDocument.documentElement.scrollHeight;
    iframe.style.height = `${h}px`;
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      sandbox="allow-same-origin"
      className="w-full border-0"
      style={{ minHeight: 120 }}
      onLoad={handleLoad}
      title="email body"
    />
  );
}

export function EmailViewer({
  threadId,
  gmailThreadId,
  subject,
  snippet = "",
  isUnread: initialUnread = false,
  todoistEnabled = false,
  onStale,
  onUnreadChange,
}: EmailViewerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isUnread, setIsUnread] = useState(initialUnread);
  const [actionError, setActionError] = useState("");
  const [acting, setActing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [loadingBodyIds, setLoadingBodyIds] = useState<Set<string>>(new Set());
  const [createModalTitle, setCreateModalTitle] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    setSummary(null);
    setSummarizing(false);
    setReplyingTo(null);

    const cached = messageCache.get(threadId) as Message[] | undefined;
    if (cached) {
      setMessages(cached);
      setExpanded(new Set(cached.length > 0 ? [cached[cached.length - 1].id] : []));
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    setMessages([]);
    setExpanded(new Set());

    fetch(`/api/threads/${threadId}/messages`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<Message[]>;
      })
      .then((data) => {
        messageCache.set(threadId, data);
        setMessages(data);
        if (data.length > 0) setExpanded(new Set([data[data.length - 1].id]));
      })
      .catch(() => setError("Failed to load messages"))
      .finally(() => setLoading(false));
  }, [threadId]);

  const doAction = useCallback(
    async (action: "archive" | "trash" | "markRead" | "markUnread") => {
      setActing(true);
      setActionError("");
      try {
        const res = await fetch(`/api/threads/${threadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "Action failed");
        }
        if (action === "markRead") { setIsUnread(false); onUnreadChange?.(false); }
        if (action === "markUnread") { setIsUnread(true); onUnreadChange?.(true); }
        if (action === "archive" || action === "trash") onStale?.();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setActing(false);
      }
    },
    [threadId, onStale, onUnreadChange]
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      next.add(id);
      return next;
    });

    // Lazy-load body if not yet fetched
    const msg = messages.find((m) => m.id === id);
    if (msg && !msg.bodyLoaded && !loadingBodyIds.has(id)) {
      setLoadingBodyIds((prev) => new Set([...prev, id]));
      fetch(`/api/threads/${threadId}/messages/${id}`)
        .then((r) => r.json() as Promise<{ html: string | null; text: string | null }>)
        .then(({ html, text }) => {
          setMessages((prev) => {
            const updated = prev.map((m) =>
              m.id === id ? { ...m, html, text, bodyLoaded: true } : m
            );
            messageCache.set(threadId, updated);
            return updated;
          });
        })
        .catch(() => {/* silently fail — snippet still shows */})
        .finally(() => setLoadingBodyIds((prev) => {
          const next = new Set(prev); next.delete(id); return next;
        }));
    }
  }

  const lastMsg = messages[messages.length - 1] ?? null;
  const from = messages[0]?.from ?? "";

  async function handleSummarize() {
    if (summarizing || messages.length === 0) return;
    setSummarizing(true);
    setSummary(null);
    try {
      const msgTexts = messages.map((m) => ({
        from: m.from,
        text: m.text ?? m.snippet ?? "",
      }));
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgTexts }),
      });
      const data = await res.json() as { summary?: string; error?: string };
      setSummary(data.summary ?? data.error ?? "Could not summarize.");
    } catch {
      setSummary("Could not reach Ollama.");
    } finally {
      setSummarizing(false);
    }
  }

  function toolBtn(label: string, kbd: string, onClick: () => void, primary = false, disabled = false) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40"
        style={primary ? {
          background: "var(--ds-ink)", borderColor: "var(--ds-ink)", color: "var(--ds-panel)",
        } : {
          background: "var(--ds-panel)", borderColor: "var(--ds-line)", color: "var(--ds-ink-2)",
        }}
      >
        {label}
        <kbd
          className="font-mono text-[10px] rounded px-1 py-px border"
          style={primary ? {
            background: "color-mix(in oklch, var(--ds-panel) 20%, transparent)",
            borderColor: "transparent",
            color: "color-mix(in oklch, var(--ds-panel) 70%, transparent)",
          } : {
            background: "var(--ds-kbd-bg)", borderColor: "var(--ds-line)", color: "var(--ds-muted)",
          }}
        >
          {kbd}
        </kbd>
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full relative" style={{ background: "var(--ds-panel)" }}>
      {/* Toolbar */}
      <div
        className="flex-shrink-0 border-b px-[22px] py-[14px] flex items-center gap-2 flex-wrap"
        style={{ borderColor: "var(--ds-line)", background: "var(--ds-panel)" }}
      >
        {toolBtn("Archive", "E", () => doAction("archive"), false, acting)}
        {toolBtn("Trash", "Del", () => doAction("trash"), false, acting)}
        {isUnread
          ? toolBtn("Mark read", "U", () => doAction("markRead"), false, acting)
          : toolBtn("Mark unread", "U", () => doAction("markUnread"), false, acting)
        }
        {toolBtn("Reply", "R", () => setReplyingTo((p) => p ? null : lastMsg), false, acting || loading || !lastMsg)}
        {toolBtn(
          summarizing ? "Summarizing…" : "Summarize",
          "S",
          handleSummarize,
          false,
          acting || loading || summarizing || messages.length === 0
        )}
        <div className="ml-auto" />
        {toolBtn("+ Turn into task", "T", () => setCreateModalTitle(subject), true)}
        <a
          href={gmailThreadUrl(gmailThreadId)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[12px] opacity-50 hover:opacity-80"
          style={{ color: "var(--ds-muted)" }}
        >
          <ExternalLink className="h-3 w-3" />
        </a>
        {actionError && <span className="text-xs text-red-500">{actionError}</span>}
      </div>

      {/* Body — extra bottom padding so content clears the AiTaskBar */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "140px" }}>
      <div className="p-[28px_36px] space-y-2">
        {/* Serif subject heading */}
        <h2
          className="font-serif font-bold text-[28px] leading-tight tracking-tight mb-3"
          style={{ color: "var(--ds-ink)" }}
        >
          {subject}
        </h2>
        {/* AI Summary banner */}
        {summary && (
          <div
            className="rounded-lg px-4 py-3 mb-3 text-sm leading-relaxed flex items-start gap-3"
            style={{ background: "color-mix(in oklch, var(--ds-hot) 8%, var(--ds-panel))", border: "1px solid color-mix(in oklch, var(--ds-hot) 20%, transparent)" }}
          >
            <span
              className="w-5 h-5 rounded flex-shrink-0 grid place-items-center text-white text-[10px] font-bold mt-0.5"
              style={{ background: "var(--ds-hot)" }}
            >
              ✦
            </span>
            <span style={{ color: "var(--ds-ink-2)" }}>{summary}</span>
            <button
              className="ml-auto flex-shrink-0 opacity-40 hover:opacity-70 text-lg leading-none"
              style={{ color: "var(--ds-ink)" }}
              onClick={() => setSummary(null)}
            >
              ×
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--ds-line)" }} />
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-16 text-sm text-red-400">
            {error}
          </div>
        )}
        {!loading &&
          !error &&
          messages.map((msg, i) => {
            const isExpanded = expanded.has(msg.id);
            const isLast = i === messages.length - 1;
            return (
              <div
                key={msg.id}
                className={`rounded-lg border shadow-sm ${isLast ? "" : "opacity-80"}`}
                style={{ background: "var(--ds-panel)", borderColor: "var(--ds-line)" }}
              >
                <button
                  className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-slate-50 rounded-t-lg"
                  onClick={() => toggle(msg.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{msg.from}</p>
                    {!isExpanded && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{msg.snippet}</p>
                    )}
                    {isExpanded && (
                      <p className="text-xs text-slate-400 mt-0.5">{msg.date}</p>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 flex-shrink-0 text-slate-300 mt-0.5" />
                  ) : (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-300 mt-0.5" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t overflow-hidden">
                    <div className="px-4 py-3">
                      {loadingBodyIds.has(msg.id) ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                        </div>
                      ) : msg.html ? (
                        <MessageFrame html={msg.html} />
                      ) : msg.text ? (
                        <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                          {msg.text}
                        </pre>
                      ) : (
                        <p className="text-sm text-slate-400">{msg.snippet}</p>
                      )}
                    </div>
                    {/* Attachments */}
                    {msg.attachments?.length > 0 && (
                      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                        {msg.attachments.map((att) => (
                          <a
                            key={att.id}
                            href={`/api/threads/${threadId}/messages/${msg.id}/attachments/${att.id}`}
                            download={att.filename}
                            className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Paperclip className="h-3 w-3 text-slate-400" />
                            <span className="max-w-[160px] truncate">{att.filename}</span>
                            <span className="text-slate-400">
                              {att.size > 1024 * 1024
                                ? `${(att.size / 1024 / 1024).toFixed(1)} MB`
                                : `${Math.round(att.size / 1024)} KB`}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Per-message reply button */}
                    <div className="px-4 pb-2 flex justify-end">
                      <button
                        className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                        onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); }}
                      >
                        <Reply className="h-3 w-3" />
                        Reply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
      </div> {/* end body scroll container */}

      {/* AI Task Bar — absolute to outer wrapper, docked above bottom edge */}
      <AiTaskBar
        threadId={threadId}
        subject={subject}
        snippet={snippet}
        from={from}
        todoistEnabled={todoistEnabled}
        onCreateTask={(aiTitle) => setCreateModalTitle(aiTitle)}
      />

      {/* Create work item modal */}
      {createModalTitle !== null && (
        <CreateWorkItemModal
          thread={{ id: threadId, subject: createModalTitle }}
          todoistEnabled={todoistEnabled}
          onClose={() => setCreateModalTitle(null)}
        />
      )}

      {/* Reply compose */}
      {replyingTo && (
        <ReplyCompose
          threadId={threadId}
          subject={subject}
          to={replyingTo.replyTo ?? replyingTo.from}
          inReplyTo={replyingTo.messageId}
          messages={messages.map((m) => ({ from: m.from, text: m.text, snippet: m.snippet }))}
          references={
            [replyingTo.references, replyingTo.messageId]
              .filter(Boolean)
              .join(" ") || null
          }
          onSent={() => {
            setReplyingTo(null);
            messageCache.delete(threadId);
            setLoading(true);
            fetch(`/api/threads/${threadId}/messages`)
              .then((r) => r.json() as Promise<Message[]>)
              .then((data) => {
                messageCache.set(threadId, data);
                setMessages(data);
                if (data.length > 0) setExpanded(new Set([data[data.length - 1].id]));
              })
              .catch(() => {})
              .finally(() => setLoading(false));
          }}
          onCancel={() => setReplyingTo(null)}
        />
      )}
    </div>
  );
}
