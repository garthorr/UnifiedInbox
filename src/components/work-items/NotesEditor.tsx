"use client";

import { useRef, useState, useCallback } from "react";
import { marked } from "marked";
import { sanitizeHtml } from "@/lib/sanitize";
import { Bold, Italic, List, Heading2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Configure marked for safe, synchronous rendering
marked.setOptions({ async: false });

interface NotesEditorProps {
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

type FormatOp =
  | { type: "wrap"; before: string; after: string }
  | { type: "linePrefix"; prefix: string };

function applyFormat(
  textarea: HTMLTextAreaElement,
  op: FormatOp,
  onChange: (val: string) => void
) {
  const { value, selectionStart: start, selectionEnd: end } = textarea;
  const selected = value.slice(start, end);
  let next = "";
  let newStart = start;
  let newEnd = end;

  if (op.type === "wrap") {
    const isWrapped =
      value.slice(start - op.before.length, start) === op.before &&
      value.slice(end, end + op.after.length) === op.after;

    if (isWrapped) {
      // Unwrap
      next =
        value.slice(0, start - op.before.length) +
        selected +
        value.slice(end + op.after.length);
      newStart = start - op.before.length;
      newEnd = end - op.before.length;
    } else {
      next =
        value.slice(0, start) +
        op.before +
        selected +
        op.after +
        value.slice(end);
      newStart = start + op.before.length;
      newEnd = end + op.before.length;
    }
  } else {
    // linePrefix: toggle prefix on every selected line
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end);
    const block = value.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    const lines = block.split("\n");
    const allPrefixed = lines.every((l) => l.startsWith(op.prefix));
    const toggled = lines
      .map((l) => (allPrefixed ? l.slice(op.prefix.length) : op.prefix + l))
      .join("\n");
    const delta = toggled.length - block.length;
    next =
      value.slice(0, lineStart) +
      toggled +
      (lineEnd === -1 ? "" : value.slice(lineEnd));
    newStart = start + (allPrefixed ? -op.prefix.length : op.prefix.length);
    newEnd = end + delta;
  }

  onChange(next);
  // Restore selection after React re-render
  requestAnimationFrame(() => {
    textarea.setSelectionRange(newStart, newEnd);
    textarea.focus();
  });
}

export function NotesEditor({ value, onChange, onSave, onCancel }: NotesEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const format = useCallback(
    (op: FormatOp) => {
      if (textareaRef.current) applyFormat(textareaRef.current, op, onChange);
    },
    [onChange]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "b") {
      e.preventDefault();
      format({ type: "wrap", before: "**", after: "**" });
    } else if (mod && e.key === "i") {
      e.preventDefault();
      format({ type: "wrap", before: "_", after: "_" });
    } else if (mod && e.key === "Enter") {
      e.preventDefault();
      onSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  }

  // marked does not sanitize (the `sanitize` option was removed), so run the
  // rendered HTML through DOMPurify before injecting it.
  const previewHtml = preview
    ? sanitizeHtml(marked.parse(value || "") as string)
    : "";

  return (
    <div className="space-y-1.5">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 rounded-t-md border border-b-0 bg-slate-50 px-1.5 py-1">
        <button
          type="button"
          title="Bold (⌘B)"
          className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40"
          disabled={preview}
          onClick={() => format({ type: "wrap", before: "**", after: "**" })}
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Italic (⌘I)"
          className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40"
          disabled={preview}
          onClick={() => format({ type: "wrap", before: "_", after: "_" })}
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Heading"
          className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40"
          disabled={preview}
          onClick={() => format({ type: "linePrefix", prefix: "## " })}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Bullet list"
          className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40"
          disabled={preview}
          onClick={() => format({ type: "linePrefix", prefix: "- " })}
        >
          <List className="h-3.5 w-3.5" />
        </button>

        <div className="ml-auto">
          <button
            type="button"
            title={preview ? "Edit" : "Preview"}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200 hover:text-slate-800"
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? (
              <>
                <EyeOff className="h-3 w-3" /> Edit
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" /> Preview
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      {preview ? (
        <div
          className="min-h-[120px] rounded-b-md border px-3 py-2 text-sm prose prose-slate prose-sm max-w-none
            [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1
            [&_ul]:my-1 [&_ul]:pl-4 [&_li]:my-0
            [&_p]:my-1 [&_strong]:font-semibold [&_em]:italic"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="rounded-t-none text-sm min-h-[120px] resize-none font-mono text-[13px]"
          placeholder="Write notes in Markdown…  ⌘B bold · ⌘I italic · ⌘↩ save"
          autoFocus
        />
      )}

      {/* Actions */}
      <div className="flex gap-1.5">
        <Button size="sm" className="h-6 text-xs" onClick={onSave}>
          Save
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
