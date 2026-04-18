"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LayoutDashboard, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function DomainViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") ?? "list";

  function setView(view: "list" | "kanban") {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "list") {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex items-center rounded-md border bg-white p-0.5 gap-0.5">
      <button
        onClick={() => setView("list")}
        title="List view"
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
          currentView === "list"
            ? "bg-slate-200 text-slate-900"
            : "text-slate-500 hover:text-slate-700"
        )}
      >
        <Rows3 className="h-3.5 w-3.5" />
        List
      </button>
      <button
        onClick={() => setView("kanban")}
        title="Board view"
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
          currentView === "kanban"
            ? "bg-slate-200 text-slate-900"
            : "text-slate-500 hover:text-slate-700"
        )}
      >
        <LayoutDashboard className="h-3.5 w-3.5" />
        Board
      </button>
    </div>
  );
}
