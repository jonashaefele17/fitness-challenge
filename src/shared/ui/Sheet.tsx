import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fade, sheetBehindScale, sheetDismiss, spring } from '@/shared/design-tokens';
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
  /** Button(s) at the right of the title, e.g. "+" to add something. */
  action?: ReactNode;
  className?: string;
}

/** Lets a sheet opened inside another one push its parent back (iOS sheet stack). */
const SheetStackContext = createContext<((covered: boolean) => void) | null>(null);

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
  action,
  className,
}: SheetProps) {
  const dragControls = useDragControls();
  const contentRef = useRef<HTMLDivElement>(null);
  const setParentCovered = useContext(SheetStackContext);
  const stacked = setParentCovered !== null;
  // Another sheet is open on top of this one.
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    if (!open || !setParentCovered) return;
    setParentCovered(true);
    return () => {
      setParentCovered(false);
    };
  }, [open, setParentCovered]);

  // Behind another sheet it grows to full height (its top edge peeks out above the new
  // sheet) and shrinks back afterwards, gliding in step with the new sheet instead of
  // jumping. Done on the element: from its measured height to the maximum and back.
  const baseHeight = useRef<number | null>(null);
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const glide = `min-height ${String(fade.base.duration)}s cubic-bezier(${fade.base.ease.join(',')})`;
    if (covered) {
      baseHeight.current = element.offsetHeight;
      element.style.transition = 'none';
      element.style.minHeight = `${String(element.offsetHeight)}px`;
      element.getBoundingClientRect(); // apply the start height before gliding
      element.style.transition = glide;
      element.style.minHeight = getComputedStyle(element).maxHeight;
      return;
    }
    if (baseHeight.current === null) return;
    element.style.transition = glide;
    element.style.minHeight = `${String(baseHeight.current)}px`;
    baseHeight.current = null;
    const reset = () => {
      element.style.transition = '';
      element.style.minHeight = '';
    };
    element.addEventListener('transitionend', reset, { once: true });
    return () => {
      element.removeEventListener('transitionend', reset);
    };
  }, [covered]);

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
            {/* One layer per sheet: a sheet opened later (on top) covers the earlier one
                together with its overlay, so the one behind is dimmed. */}
            <div className="fixed inset-0 z-40">
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className="absolute inset-0 bg-overlay"
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
                    'absolute inset-x-0 bottom-0 flex max-h-(--spacing-sheet-max) origin-top flex-col rounded-t-sheet border-t border-border bg-surface pb-safe outline-none',
                    stacked && 'max-h-(--spacing-sheet-stacked)',
                    className,
                  )}
                  initial={{ y: '100%' }}
                  animate={{ y: 0, scale: covered ? sheetBehindScale : 1 }}
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
                    <div
                      aria-hidden
                      className="mx-auto mb-3 h-1.5 w-10 rounded-pill bg-surface-3"
                    />
                    <div className="flex min-h-tap items-center justify-between gap-3">
                      <Dialog.Title
                        className={cn('text-title-3 font-semibold', hideTitle && 'sr-only')}
                      >
                        {title}
                      </Dialog.Title>
                      {action && (
                        // Taps on the action must not start dragging the sheet.
                        <div
                          className="shrink-0"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          {action}
                        </div>
                      )}
                    </div>
                    {description && (
                      <Dialog.Description className="mt-1 text-subhead text-text-muted">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                  <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter pb-4">
                    <SheetStackContext.Provider value={setCovered}>
                      {children}
                    </SheetStackContext.Provider>
                  </div>
                  {footer && (
                    <div className="shrink-0 border-t border-border px-gutter pt-3 pb-2">
                      {footer}
                    </div>
                  )}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
