"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { messageCache } from "@/lib/client-message-cache";
import {
  Loader2, ExternalLink, ChevronDown, ChevronUp,
  ArchiveIcon, Trash2, Mail, MailOpen, Reply, Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReplyCompose } from "./ReplyCompose";
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
  isUnread?: boolean;
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
  isUnread: initialUnread = false,
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

  useEffect(() => {
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

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white px-4 py-2.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{subject}</p>
          {!loading && !error && (
            <p className="text-xs text-slate-400">
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <a
          href={gmailThreadUrl(gmailThreadId)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"
        >
          <ExternalLink className="h-3 w-3" />
          Gmail
        </a>
      </div>

      {/* Action toolbar */}
      <div className="flex-shrink-0 border-b bg-white px-4 py-1.5 flex items-center gap-1">
        <Button
          variant="ghost" size="sm"
          className="h-7 text-xs gap-1.5 text-slate-600"
          disabled={acting}
          onClick={() => doAction("archive")}
          title="Archive"
        >
          <ArchiveIcon className="h-3.5 w-3.5" />
          Archive
        </Button>
        <Button
          variant="ghost" size="sm"
          className="h-7 text-xs gap-1.5 text-slate-600"
          disabled={acting}
          onClick={() => doAction("trash")}
          title="Move to trash"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Trash
        </Button>
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        {isUnread ? (
          <Button
            variant="ghost" size="sm"
            className="h-7 text-xs gap-1.5 text-slate-600"
            disabled={acting}
            onClick={() => doAction("markRead")}
            title="Mark as read"
          >
            <MailOpen className="h-3.5 w-3.5" />
            Mark read
          </Button>
        ) : (
          <Button
            variant="ghost" size="sm"
            className="h-7 text-xs gap-1.5 text-slate-600"
            disabled={acting}
            onClick={() => doAction("markUnread")}
            title="Mark as unread"
          >
            <Mail className="h-3.5 w-3.5" />
            Mark unread
          </Button>
        )}
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        <Button
          variant="ghost" size="sm"
          className="h-7 text-xs gap-1.5 text-slate-600"
          disabled={acting || loading || !lastMsg}
          onClick={() => setReplyingTo((prev) => (prev ? null : lastMsg))}
          title="Reply to latest message"
        >
          <Reply className="h-3.5 w-3.5" />
          Reply
        </Button>
        {actionError && (
          <span className="ml-2 text-xs text-red-500">{actionError}</span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
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
                className={`rounded-lg border bg-white shadow-sm ${isLast ? "" : "opacity-80"}`}
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

      {/* Reply compose */}
      {replyingTo && (
        <ReplyCompose
          threadId={threadId}
          subject={subject}
          to={replyingTo.replyTo ?? replyingTo.from}
          inReplyTo={replyingTo.messageId}
          references={
            [replyingTo.references, replyingTo.messageId]
              .filter(Boolean)
              .join(" ") || null
          }
          onSent={() => {
            setReplyingTo(null);
            // Bust cache and reload so the sent reply appears
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
