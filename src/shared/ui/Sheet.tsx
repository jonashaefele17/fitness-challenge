import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { fade, sheetDismiss, spring } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visually hide the title (still read by screen readers). */
  hideTitle?: boolean;
  description?: string;
  children?: ReactNode;
  /** Pinned below the scrolling content, e.g. a comment composer. */
  footer?: ReactNode;
  className?: string;
}

/**
 * Bottom sheet: springs up, can be dragged down by its handle/header to dismiss.
 * Built on Radix Dialog for focus trapping, Escape and aria wiring.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  hideTitle = false,
  description,
  children,
  footer,
  className,
}: SheetProps) {
  const dragControls = useDragControls();
  const contentRef = useRef<HTMLDivElement>(null);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > sheetDismiss.offset || info.velocity.y > sheetDismiss.velocity) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fade.base}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              {...(description ? {} : { 'aria-describedby': undefined })}
              // Focus the sheet itself instead of its first input, so opening a sheet with a
              // text field does not pop up the iPhone keyboard.
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                contentRef.current?.focus();
              }}
            >
              <motion.div
                ref={contentRef}
                className={cn(
                  'fixed inset-x-0 bottom-0 z-50 flex max-h-(--spacing-sheet-max) flex-col rounded-t-sheet border-t border-border bg-surface pb-safe outline-none',
                  className,
                )}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={spring.sheet}
                drag="y"
                dragListener={false}
                dragControls={dragControls}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.7 }}
                onDragEnd={handleDragEnd}
              >
                <div
                  className="shrink-0 cursor-grab touch-none px-gutter pt-2 pb-3"
                  onPointerDown={(event) => {
                    dragControls.start(event);
                  }}
                >
                  <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-pill bg-surface-3" />
                  <Dialog.Title
                    className={cn('text-title-3 font-semibold', hideTitle && 'sr-only')}
                  >
                    {title}
                  </Dialog.Title>
                  {description && (
                    <Dialog.Description className="mt-1 text-subhead text-text-muted">
                      {description}
                    </Dialog.Description>
                  )}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter pb-4">
                  {children}
                </div>
                {footer && (
                  <div className="shrink-0 border-t border-border px-gutter pt-3 pb-2">
                    {footer}
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
