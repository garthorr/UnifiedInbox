"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { subscribe, dismiss, close, type ToastState } from "@/lib/toast";

export function Toaster() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  useEffect(() => subscribe(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 rounded-lg px-3.5 py-2.5 shadow-lg border min-w-[280px] max-w-[420px]"
          style={{
            background:
              t.variant === "error"
                ? "color-mix(in oklch, var(--ds-hot) 12%, var(--ds-ink))"
                : "var(--ds-ink)",
            borderColor:
              t.variant === "error"
                ? "color-mix(in oklch, var(--ds-hot) 50%, var(--ds-line))"
                : "var(--ds-line)",
            color: "var(--ds-panel)",
          }}
          role={t.variant === "error" ? "alert" : "status"}
        >
          <span className="text-[13px] flex-1 leading-snug">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.onClick();
                close(t.id);
              }}
              className="text-[12px] font-bold uppercase tracking-wide hover:opacity-80 transition-opacity"
              style={{ color: "var(--ds-accent)" }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="opacity-50 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
