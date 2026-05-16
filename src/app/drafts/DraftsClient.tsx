"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileEdit, Mail, MessageSquare, Trash2 } from "lucide-react";
import { ComposeEmail } from "@/components/inbox/ComposeEmail";
import {
  deleteDraft,
  listDrafts,
  subscribeDrafts,
  type Draft,
} from "@/lib/drafts";
import { relativeTime } from "@/lib/utils";

interface Account {
  id: string;
  email: string;
  displayName: string;
}

interface DraftsClientProps {
  accounts: Account[];
}

export function DraftsClient({ accounts }: DraftsClientProps) {
  // Hydrate from localStorage after mount so SSR doesn't mismatch.
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [openComposeId, setOpenComposeId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setDrafts(listDrafts());
    refresh();
    return subscribeDrafts(refresh);
  }, []);

  const openCompose = openComposeId
    ? drafts?.find((d) => d.id === openComposeId)
    : null;

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <FileEdit className="h-5 w-5 text-slate-500" />
            <h1 className="text-xl font-semibold text-slate-800">Drafts</h1>
            {drafts && drafts.length > 0 && (
              <span className="ml-1 font-mono text-xs text-slate-400">
                {drafts.length}
              </span>
            )}
          </div>

          {drafts === null ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : drafts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-10 text-center">
              <FileEdit className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">No drafts</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Anything you start typing in compose or a reply is saved here
                automatically until you send or discard it.
              </p>
            </div>
          ) : (
            <ul className="divide-y border rounded-lg bg-white">
              {drafts.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  onOpen={() => {
                    if (d.kind === "compose") setOpenComposeId(d.id);
                    // Reply drafts: navigation handles open, EmailViewer
                    // auto-surfaces the saved draft when the thread loads.
                  }}
                  onDelete={() => deleteDraft(d.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {openCompose && openCompose.kind === "compose" && (
        <ComposeEmail
          accounts={accounts}
          defaultAccountId={openCompose.accountId}
          draftId={openCompose.id}
          onClose={() => setOpenComposeId(null)}
        />
      )}
    </div>
  );
}

function DraftRow({
  draft,
  onOpen,
  onDelete,
}: {
  draft: Draft;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const preview = draft.body.trim().slice(0, 140) || "(empty body)";
  const subjectLine =
    draft.kind === "reply"
      ? draft.subject.startsWith("Re:")
        ? draft.subject
        : `Re: ${draft.subject}`
      : draft.subject.trim() || "(no subject)";

  const icon =
    draft.kind === "reply" ? (
      <MessageSquare className="h-4 w-4 text-slate-400" />
    ) : (
      <Mail className="h-4 w-4 text-slate-400" />
    );

  const inner = (
    <div className="flex items-start gap-3 p-4">
      <div className="pt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            {draft.kind}
          </span>
          <p className="text-sm font-medium text-slate-800 truncate">
            {subjectLine}
          </p>
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {draft.kind === "reply" ? `To ${draft.to}` : draft.to || "No recipient"}
        </p>
        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{preview}</p>
        <p className="text-[11px] text-slate-400 mt-1.5">
          Saved {relativeTime(new Date(draft.updatedAt))}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="flex-shrink-0 text-slate-300 hover:text-red-500 p-1"
        title="Discard draft"
        aria-label="Discard draft"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  // Reply drafts deep-link to the thread; the EmailViewer auto-opens the
  // compose with the stored body.
  if (draft.kind === "reply") {
    return (
      <li>
        <Link href={`/?thread=${encodeURIComponent(draft.threadId)}`} className="block hover:bg-slate-50">
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <button onClick={onOpen} className="block w-full text-left hover:bg-slate-50">
        {inner}
      </button>
    </li>
  );
}
