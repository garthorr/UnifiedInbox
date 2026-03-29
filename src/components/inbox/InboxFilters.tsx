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
import { Search, X } from "lucide-react";

interface Account {
  id: string;
  email: string;
}

interface InboxFiltersProps {
  accounts: Account[];
}

// Named view presets — each maps to a set of URL params
const VIEWS = [
  { label: "This week",    params: { days: "7" } },
  { label: "Unread",       params: { isUnread: "true", days: "14" } },
  { label: "This month",   params: { days: "30" } },
  { label: "Last 90 days", params: { days: "90" } },
] as const;

export function InboxFilters({ accounts }: InboxFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const accountId = searchParams.get("accountId") ?? "all";
  const isUnread = searchParams.get("isUnread") === "true";
  const days = searchParams.get("days") ?? "7";
  const q = searchParams.get("q") ?? "";

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

  function applyView(viewParams: Record<string, string>) {
    const params = new URLSearchParams();
    // Preserve account filter across view switches
    const currentAccount = searchParams.get("accountId");
    if (currentAccount) params.set("accountId", currentAccount);
    for (const [k, v] of Object.entries(viewParams)) {
      if (v !== "7") params.set(k, v); // 7 days is the default, omit it
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  // Determine which preset is active (ignores accountId)
  const activeView = VIEWS.find(({ params: vp }) => {
    const vpDays = vp.days ?? "7";
    const vpUnread = ("isUnread" in vp && vp.isUnread === "true") ? "true" : null;
    return days === vpDays && (vpUnread ? isUnread : !isUnread);
  });

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

      {/* Row 2: saved view presets */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-400 mr-1">Views:</span>
        {VIEWS.map((v) => (
          <button
            key={v.label}
            onClick={() => applyView(v.params)}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              activeView?.label === v.label
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
