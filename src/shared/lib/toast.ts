import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  message: string;
  /** Optional action, e.g. "Rückgängig". */
  action?: { label: string; onAction: () => void } | undefined;
}

const DURATION_MS = 4500;
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function dismissToast(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

/** Shows a short message at the bottom; with an action it doubles as "undo" (rule 11). */
export function showToast(message: string, action?: Toast['action']): number {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, message, action }];
  emit();
  setTimeout(() => {
    dismissToast(id);
  }, DURATION_MS);
  return id;
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => toasts,
  );
}
