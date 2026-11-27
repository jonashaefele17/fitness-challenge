import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@/shared/design-tokens';
import { dismissToast, useToasts } from '@/shared/lib/toast';

/** Renders toasts above the floating navigation. Mount once in the app shell. */
export function Toaster() {
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      // Sheets and dialogs do not count a tap on a toast ("Rückgängig") as a tap outside.
      data-toaster
      className="pointer-events-none fixed inset-x-0 top-toast z-50 flex flex-col items-center gap-2 px-gutter"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={spring.snappy}
            className="pointer-events-auto flex min-h-tap w-full max-w-md items-center justify-between gap-3 rounded-pill glass pr-2 pl-5 text-subhead"
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="min-h-tap rounded-pill px-3 font-semibold text-accent"
                onClick={() => {
                  toast.action?.onAction();
                  dismissToast(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
