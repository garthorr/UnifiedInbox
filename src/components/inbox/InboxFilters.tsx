"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { Search, X, ChevronDown } from "lucide-react";
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
  { label: "Today",       days: "1"  },
  { label: "This week",   days: "7"  },
  { label: "This month",  days: "30" },
  { label: "90 days",     days: "90" },
] as const;

export function InboxFilters({ accounts, labels = [], totalCount, unreadCount }: InboxFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const accountId  = searchParams.get("accountId") ?? "all";
  const isUnread   = searchParams.get("isUnread") === "true";
  const days       = searchParams.get("days") ?? "7";
  const q          = searchParams.get("q") ?? "";
  const activeLabel = searchParams.get("label") ?? "";

  const labelOptions = labels
    .filter((l) => l.type === "user")
    .reduce<LabelOption[]>((acc, l) => {
      if (!acc.some((x) => x.name === l.name)) acc.push(l);
      return acc;
    }, []);

  const [searchDraft, setSearchDraft] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setSearchDraft(q); }, [q]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || value === "all" || value === "false") {
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
    debounceRef.current = setTimeout(() => updateParam("q", value || null), 350);
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
          background: active ? "var(--ds-ink)" : "var(--ds-panel)",
          borderColor: active ? "var(--ds-ink)" : "var(--ds-line)",
          color: active ? "var(--ds-panel)" : "var(--ds-ink-2)",
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
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
            <strong style={{ color: "var(--ds-ink)" }}>{totalCount}</strong> thread{totalCount !== 1 ? "s" : ""}
            {unreadCount !== undefined && unreadCount > 0 && (
              <> · <strong style={{ color: "var(--ds-ink)" }}>{unreadCount}</strong> unread</>
            )}
          </span>
        )}
      </div>

      {/* Search row */}
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
          style={{ color: "var(--ds-muted)" }}
        />
        <input
          value={searchDraft}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search threads, senders, labels…"
          className="w-full rounded-md border pr-12 pl-9 py-[7px] text-[13px] focus:outline-none focus:ring-2"
          style={{
            background: "var(--ds-panel-2)",
            borderColor: "var(--ds-line)",
            color: "var(--ds-ink)",
            fontFamily: "Inter, sans-serif",
          }}
        />
        {searchDraft ? (
          <button
            onClick={() => { setSearchDraft(""); updateParam("q", null); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--ds-muted)" }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd
            className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10.5px] px-1.5 py-px rounded border"
            style={{
              background: "var(--ds-kbd-bg)",
              borderColor: "var(--ds-line)",
              color: "var(--ds-muted)",
            }}
          >
            /
          </kbd>
        )}
      </div>

      {/* Filter chips row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Range chips */}
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
            active={activeLabel === "INBOX"}
            onClick={() => updateParam("label", activeLabel === "INBOX" ? null : "INBOX")}
          >
            Inbox
          </Chip>

          {/* Label picker */}
          {labelOptions.length > 0 && (
            <Select
              value={activeLabel && activeLabel !== "INBOX" ? activeLabel : "__none__"}
              onValueChange={(v) => updateParam("label", v === "__none__" ? null : v)}
            >
              <SelectTrigger
                className="h-7 rounded-full border px-3 text-[12px] font-medium gap-1"
                style={{
                  background: activeLabel && activeLabel !== "INBOX" ? "var(--ds-ink)" : "var(--ds-panel)",
                  borderColor: activeLabel && activeLabel !== "INBOX" ? "var(--ds-ink)" : "var(--ds-line)",
                  color: activeLabel && activeLabel !== "INBOX" ? "var(--ds-panel)" : "var(--ds-ink-2)",
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
                        <span className="h-2 w-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: l.color }} />
                      )}
                      {l.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Account picker */}
          {accounts.length > 1 && (
            <Select
              value={accountId}
              onValueChange={(v) => updateParam("accountId", v === "all" ? null : v)}
            >
              <SelectTrigger
                className="h-7 rounded-full border px-3 text-[12px] font-medium gap-1 max-w-[160px]"
                style={{
                  background: accountId !== "all" ? "var(--ds-ink)" : "var(--ds-panel)",
                  borderColor: accountId !== "all" ? "var(--ds-ink)" : "var(--ds-line)",
                  color: accountId !== "all" ? "var(--ds-panel)" : "var(--ds-ink-2)",
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
