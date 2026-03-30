"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Tag } from "lucide-react";

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
}

// Time-range view presets — only change the days window, nothing else
const VIEWS = [
  { label: "This week",    days: "7"  },
  { label: "This month",   days: "30" },
  { label: "Last 90 days", days: "90" },
] as const;

export function InboxFilters({ accounts, labels = [] }: InboxFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const accountId = searchParams.get("accountId") ?? "all";
  const isUnread = searchParams.get("isUnread") === "true";
  const days = searchParams.get("days") ?? "7";
  const q = searchParams.get("q") ?? "";
  const activeLabel = searchParams.get("label") ?? "";

  // Deduplicate labels by name for the picker (keep first occurrence per name)
  const labelOptions = labels
    .filter((l) => l.type === "user")
    .reduce<LabelOption[]>((acc, l) => {
      if (!acc.some((x) => x.name === l.name)) acc.push(l);
      return acc;
    }, []);

  // Local state for the search input so it doesn't push on every keystroke
  const [searchDraft, setSearchDraft] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep draft in sync if URL changes from outside (e.g. browser back)
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
    debounceRef.current = setTimeout(() => {
      updateParam("q", value || null);
    }, 350);
  }

  function clearSearch() {
    setSearchDraft("");
    updateParam("q", null);
  }

  function applyView(targetDays: string) {
    // Only update the time window — preserve isUnread, label, account, q
    updateParam("days", targetDays === "7" ? null : targetDays);
  }

  // Active view matches on days only
  const activeViewDays = VIEWS.find((v) => v.days === days)?.days ?? null;

  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      {/* Row 1: search + account + unread + date */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <Input
            value={searchDraft}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search threads…"
            className="h-8 pl-7 pr-7 text-xs w-52"
          />
          {searchDraft && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select
          value={accountId}
          onValueChange={(v) => updateParam("accountId", v === "all" ? null : v)}
        >
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="All Accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={isUnread ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => updateParam("isUnread", isUnread ? null : "true")}
        >
          Unread only
        </Button>

        {/* Inbox-only toggle */}
        <Button
          variant={activeLabel === "INBOX" ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => updateParam("label", activeLabel === "INBOX" ? null : "INBOX")}
        >
          Inbox
        </Button>

        {/* Label picker */}
        {labelOptions.length > 0 && (
          <Select
            value={activeLabel && activeLabel !== "INBOX" ? activeLabel : "__none__"}
            onValueChange={(v) => updateParam("label", v === "__none__" ? null : v)}
          >
            <SelectTrigger className={`h-8 w-[150px] text-xs gap-1.5 ${activeLabel && activeLabel !== "INBOX" ? "border-blue-400 text-blue-700" : ""}`}>
              <Tag className="h-3 w-3 flex-shrink-0 text-slate-400" />
              <SelectValue placeholder="Label…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">All labels</SelectItem>
              {labelOptions.map((l) => (
                <SelectItem key={l.gmailLabelId} value={l.gmailLabelId}>
                  <span className="flex items-center gap-2">
                    {l.color && (
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0 inline-block"
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

        <Select
          value={days}
          onValueChange={(v) => updateParam("days", v === "7" ? null : v)}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="3">Last 3 days</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: time-range presets */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-400 mr-1">Range:</span>
        {VIEWS.map((v) => (
          <button
            key={v.label}
            onClick={() => applyView(v.days)}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              activeViewDays === v.days
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
