// Minimal toast event bus. UI subscribes via `subscribe()`; callers invoke
// `toast()` from anywhere. Designed for undo-style transient notifications.

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export type ToastVariant = "default" | "error" | "success";

export interface ToastState {
  id: number;
  message: string;
  action?: ToastAction;
  variant: ToastVariant;
  /** Fires on auto-dismiss or manual dismiss (not when action is clicked). */
  onDismiss?: () => void;
}

export interface ToastInput {
  message: string;
  action?: ToastAction;
  variant?: ToastVariant;
  /** Auto-dismiss after this many ms. 0 disables auto-dismiss. Default 4000. */
  duration?: number;
  onDismiss?: () => void;
}

type Listener = (toasts: ToastState[]) => void;

const listeners = new Set<Listener>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let toasts: ToastState[] = [];
let nextId = 1;

function emit(): void {
  for (const l of listeners) l(toasts);
}

export function toast(input: ToastInput): number {
  const id = nextId++;
  const state: ToastState = {
    id,
    message: input.message,
    action: input.action,
    variant: input.variant ?? "default",
    onDismiss: input.onDismiss,
  };
  toasts = [...toasts, state];
  emit();

  const duration = input.duration ?? 4000;
  if (duration > 0) {
    timers.set(id, setTimeout(() => dismiss(id), duration));
  }
  return id;
}

/** Remove a toast and fire its onDismiss handler. No-op if already gone. */
export function dismiss(id: number): void {
  const target = toasts.find((t) => t.id === id);
  if (!target) return;
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter((t) => t.id !== id);
  emit();
  target.onDismiss?.();
}

/** Remove a toast silently — used when its action is clicked. */
export function close(id: number): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  l(toasts);
  return () => {
    listeners.delete(l);
  };
}
