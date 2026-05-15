"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Account {
  id: string;
  email: string;
}

interface LabelOption {
  gmailLabelId: string;
  name: string;
  color: string | null;
  type: string;
  accountId: string;
}

interface InboxFiltersProps {
  accounts: Account[];
  labels?: LabelOption[];
  totalCount?: number;
  unreadCount?: number;
}

const RANGE_CHIPS = [
  { label: "Today",      days: "1"  },
  { label: "This week",  days: "7"  },
  { label: "This month", days: "30" },
  { label: "90 days",    days: "90" },
] as const;

// Parse Gmail-style operators out of a raw search string.
function parseOperators(raw: string) {
  const result: Record<string, string> = {};
  let remaining = raw;
  const pattern = /\b(from|to|subject|is|has|after|before):(\S+)/gi;
  remaining = remaining.replace(pattern, (_, op: string, val: string) => {
    result[op.toLowerCase()] = val;
    return "";
  });
  return { plainQ: remaining.trim(), operators: result };
}

function operatorsToParams(ops: Record<string, string>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  if (ops.from)              out.from          = ops.from;
  if (ops.subject)           out.q             = ops.subject;
  if (ops.is === "unread")   out.isUnread      = "true";
  if (ops.has === "attachment") out.hasAttachment = "true";
  if (ops.after)             out.after         = ops.after;
  if (ops.before)            out.before        = ops.before;
  return out;
}

export function InboxFilters({ accounts, labels = [], totalCount, unreadCount }: InboxFiltersProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const accountId   = searchParams.get("accountId") ?? "all";
  const isUnread    = searchParams.get("isUnread") === "true";
  const days        = searchParams.get("days") ?? "7";
  const q           = searchParams.get("q") ?? "";
  const activeLabel = searchParams.get("label") ?? "";
  const from        = searchParams.get("from") ?? "";
  const hasAttach   = searchParams.get("hasAttachment") === "true";
  const after       = searchParams.get("after") ?? "";
  const before      = searchParams.get("before") ?? "";

  const labelOptions = labels
    .filter((l) => l.type === "user")
    .reduce<LabelOption[]>((acc, l) => {
      if (!acc.some((x) => x.name === l.name)) acc.push(l);
      return acc;
    }, []);

  // Build the initial draft value from URL params
  function buildDraft() {
    const parts: string[] = [];
    if (from)      parts.push(`from:${from}`);
    if (hasAttach) parts.push("has:attachment");
    if (after)     parts.push(`after:${after}`);
    if (before)    parts.push(`before:${before}`);
    if (q)         parts.push(q);
    return parts.join(" ");
  }

  const [searchDraft, setSearchDraft] = useState(buildDraft);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchDraft(buildDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, from, hasAttach, after, before]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === "all" || value === "false") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const updateParam = useCallback(
    (key: string, value: string | null) => updateParams({ [key]: value }),
    [updateParams]
  );

  function handleSearchChange(value: string) {
    setSearchDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const { plainQ, operators } = parseOperators(value);
      const opParams = operatorsToParams(operators);
      updateParams({
        q:             plainQ || null,
        from:          opParams.from          ?? null,
        hasAttachment: opParams.hasAttachment ?? null,
        after:         opParams.after         ?? null,
        before:        opParams.before        ?? null,
        ...(opParams.isUnread ? { isUnread: "true" } : {}),
        ...(opParams.q ? { q: opParams.q } : {}),
      });
    }, 350);
  }

  function clearSearch() {
    setSearchDraft("");
    updateParams({ q: null, from: null, hasAttachment: null, after: null, before: null });
  }

  // Chips for active parsed operators (derived from URL params)
  type OperatorChip = { label: string; paramKey: string; opKey: string };
  const operatorChips: OperatorChip[] = [
    ...(from      ? [{ label: `from:${from}`,    paramKey: "from",          opKey: "from"  }] : []),
    ...(hasAttach ? [{ label: "has:attachment",  paramKey: "hasAttachment", opKey: "has"   }] : []),
    ...(after     ? [{ label: `after:${after}`,  paramKey: "after",         opKey: "after" }] : []),
    ...(before    ? [{ label: `before:${before}`,paramKey: "before",        opKey: "before"}] : []),
  ];

  function removeOperatorChip(chip: OperatorChip) {
    updateParam(chip.paramKey, null);
    // Strip the operator from the draft text too
    const { plainQ, operators } = parseOperators(searchDraft);
    const newOps = { ...operators };
    delete newOps[chip.opKey];
    const rebuilt = [
      ...Object.entries(newOps).map(([k, v]) => `${k}:${v}`),
      plainQ,
    ].filter(Boolean).join(" ");
    setSearchDraft(rebuilt);
  }

  function Chip({
    active,
    onClick,
    children,
  }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium border transition-colors cursor-pointer"
        style={{
          background:  active ? "var(--ds-ink)"   : "var(--ds-panel)",
          borderColor: active ? "var(--ds-ink)"   : "var(--ds-line)",
          color:       active ? "var(--ds-panel)"  : "var(--ds-ink-2)",
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-w-0">
      {/* Title row */}
      <div className="flex items-baseline gap-3">
        <h1
          className="font-serif font-bold text-[24px] tracking-tight leading-none"
          style={{ color: "var(--ds-ink)" }}
        >
          All Mail
        </h1>
        {totalCount !== undefined && (
          <span className="font-mono text-[12px]" style={{ color: "var(--ds-muted)" }}>
            <strong style={{ color: "var(--ds-ink)" }}>{totalCount}</strong>{" "}
            thread{totalCount !== 1 ? "s" : ""}
            {unreadCount !== undefined && unreadCount > 0 && (
              <> · <strong style={{ color: "var(--ds-ink)" }}>{unreadCount}</strong> unread</>
            )}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
          style={{ color: "var(--ds-muted)" }}
        />
        <input
          value={searchDraft}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search… or type from: has:attachment after: before:"
          data-search="inbox"
          className="w-full rounded-md border pr-12 pl-9 py-[7px] text-[13px] focus:outline-none focus:ring-2"
          style={{
            background:  "var(--ds-panel-2)",
            borderColor: "var(--ds-line)",
            color:       "var(--ds-ink)",
          }}
        />
        {searchDraft ? (
          <button
            onClick={clearSearch}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--ds-muted)" }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd
            className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10.5px] px-1.5 py-px rounded border"
            style={{
              background:  "var(--ds-kbd-bg)",
              borderColor: "var(--ds-line)",
              color:       "var(--ds-muted)",
            }}
          >
            /
          </kbd>
        )}
      </div>

      {/* Active operator chips */}
      {operatorChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {operatorChips.map((chip) => (
            <span
              key={chip.paramKey}
              className="flex items-center gap-1 rounded-full border pl-2.5 pr-1.5 py-0.5 text-[11px] font-medium"
              style={{
                background:  "var(--ds-accent-bg)",
                borderColor: "var(--ds-accent)",
                color:       "var(--ds-accent-ink)",
              }}
            >
              {chip.label}
              <button
                onClick={() => removeOperatorChip(chip)}
                className="opacity-60 hover:opacity-100 ml-0.5"
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {RANGE_CHIPS.map((v) => (
          <Chip
            key={v.days}
            active={days === v.days}
            onClick={() => updateParam("days", v.days === "7" ? null : v.days)}
          >
            {v.label}
          </Chip>
        ))}

        <div className="ml-auto flex items-center gap-1.5">
          <Chip active={isUnread} onClick={() => updateParam("isUnread", isUnread ? null : "true")}>
            Unread only
          </Chip>
          <Chip
            active={hasAttach}
            onClick={() => updateParam("hasAttachment", hasAttach ? null : "true")}
          >
            Has attachment
          </Chip>
          <Chip
            active={activeLabel === "INBOX"}
            onClick={() => updateParam("label", activeLabel === "INBOX" ? null : "INBOX")}
          >
            Inbox
          </Chip>

          {labelOptions.length > 0 && (
            <Select
              value={activeLabel && activeLabel !== "INBOX" ? activeLabel : "__none__"}
              onValueChange={(v) => updateParam("label", v === "__none__" ? null : v)}
            >
              <SelectTrigger
                className="h-7 rounded-full border px-3 text-[12px] font-medium gap-1"
                style={{
                  background:  activeLabel && activeLabel !== "INBOX" ? "var(--ds-ink)" : "var(--ds-panel)",
                  borderColor: activeLabel && activeLabel !== "INBOX" ? "var(--ds-ink)" : "var(--ds-line)",
                  color:       activeLabel && activeLabel !== "INBOX" ? "var(--ds-panel)" : "var(--ds-ink-2)",
                }}
              >
                <SelectValue placeholder="All labels ▾" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">All labels</SelectItem>
                {labelOptions.map((l) => (
                  <SelectItem key={l.gmailLabelId} value={l.gmailLabelId}>
                    <span className="flex items-center gap-2">
                      {l.color && (
                        <span
                          className="h-2 w-2 rounded-full inline-block flex-shrink-0"
                          style={{ backgroundColor: l.color }}
                        />
                      )}
                      {l.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {accounts.length > 1 && (
            <Select
              value={accountId}
              onValueChange={(v) => updateParam("accountId", v === "all" ? null : v)}
            >
              <SelectTrigger
                className="h-7 rounded-full border px-3 text-[12px] font-medium gap-1 max-w-[160px]"
                style={{
                  background:  accountId !== "all" ? "var(--ds-ink)" : "var(--ds-panel)",
                  borderColor: accountId !== "all" ? "var(--ds-ink)" : "var(--ds-line)",
                  color:       accountId !== "all" ? "var(--ds-panel)" : "var(--ds-ink-2)",
                }}
              >
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  );
}
