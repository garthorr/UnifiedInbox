import { Skeleton } from "@/components/ui/skeleton";

function ThreadRowSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: "var(--ds-line)" }}>
      <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
      <Skeleton className="h-2.5 w-2.5 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className={`h-3 ${wide ? "w-2/3" : "w-1/2"}`} />
        <Skeleton className="h-2.5 w-full" />
      </div>
      <Skeleton className="h-2.5 w-10 flex-shrink-0" />
    </div>
  );
}

export function InboxSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--ds-panel)" }}>
      {/* Header bar */}
      <div
        className="flex-shrink-0 border-b px-5 pt-[14px] pb-[10px]"
        style={{ background: "var(--ds-panel)", borderColor: "var(--ds-line)" }}
      >
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-16" />
          <div className="ml-auto">
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-hidden">
        {/* Group header */}
        <div className="px-5 py-[18px]">
          <Skeleton className="h-2.5 w-28" />
        </div>
        {[true, false, true, false, false].map((wide, i) => (
          <ThreadRowSkeleton key={i} wide={wide} />
        ))}
        <div className="px-5 py-[18px]">
          <Skeleton className="h-2.5 w-20" />
        </div>
        {[false, true, false].map((wide, i) => (
          <ThreadRowSkeleton key={i} wide={wide} />
        ))}
      </div>
    </div>
  );
}
