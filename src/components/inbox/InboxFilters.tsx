"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
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

interface InboxFiltersProps {
  accounts: Account[];
}

export function InboxFilters({ accounts }: InboxFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const accountId = searchParams.get("accountId") ?? "all";
  const isUnread = searchParams.get("isUnread") === "true";
  const days = searchParams.get("days") ?? "7";

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "all" || value === "false" || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        value={accountId}
        onValueChange={(v) => updateParam("accountId", v === "all" ? null : v)}
      >
        <SelectTrigger className="h-8 w-[200px] text-xs">
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
        <SelectTrigger className="h-8 w-[140px] text-xs">
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
  );
}
