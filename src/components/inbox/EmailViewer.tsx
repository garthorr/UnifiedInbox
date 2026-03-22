"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { gmailThreadUrl } from "@/lib/utils";

interface Message {
  id: string;
  from: string;
  to: string;
  date: string;
  snippet: string | null;
  html: string | null;
  text: string | null;
}

interface EmailViewerProps {
  threadId: string;
  gmailThreadId: string;
  subject: string;
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

export function EmailViewer({ threadId, gmailThreadId, subject }: EmailViewerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
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
        setMessages(data);
        // Auto-expand the last message
        if (data.length > 0) {
          setExpanded(new Set([data[data.length - 1].id]));
        }
      })
      .catch(() => setError("Failed to load messages"))
      .finally(() => setLoading(false));
  }, [threadId]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
                className={`rounded-lg border bg-white shadow-sm ${
                  isLast ? "" : "opacity-80"
                }`}
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
                  <div className="border-t px-4 py-3 overflow-hidden">
                    {msg.html ? (
                      <MessageFrame html={msg.html} />
                    ) : msg.text ? (
                      <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {msg.text}
                      </pre>
                    ) : (
                      <p className="text-sm text-slate-400">{msg.snippet}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
