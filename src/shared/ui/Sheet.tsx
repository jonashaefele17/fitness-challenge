import * as Dialog from '@radix-ui/react-dialog';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  fade,
  sheetBehind,
  sheetBehindScale,
  sheetDetent,
  sheetDismiss,
  spring,
} from '@/shared/design-tokens';
import { cn } from '@/shared/lib';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visually hide the title (still read by screen readers). */
  hideTitle?: boolean;
  description?: string;
  children?: ReactNode;
  /** Pinned below the scrolling content, e.g. a comment composer (opens at full height). */
  footer?: ReactNode;
  /** Button(s) at the right of the title, e.g. "+" to add something. */
  action?: ReactNode;
  /**
   * Forms and flows (buttons at the bottom): open at full height / fitting the content,
   * never at the middle step. The middle step is for things to look through.
   */
  fullHeight?: boolean;
  className?: string;
}

/** Lets a sheet opened inside another one push its parent back (iOS sheet stack). */
const SheetStackContext = createContext<((covered: boolean) => void) | null>(null);

/** Places that drag vertically themselves: the sheet leaves them alone. */
const OWN_GESTURE = '[data-wheel], [aria-roledescription="sortable"], [data-sheet-no-drag]';

interface Gesture {
  x: number;
  y: number;
  /** Sheet offset when the sheet took over. */
  from: number;
  /** Finger position when the sheet took over. */
  anchor: number;
  mode: 'undecided' | 'sheet' | 'native';
  samples: { y: number; t: number }[];
  /** The push went on past full height into the content. */
  scrolled: boolean;
}

/**
 * Bottom sheet as in iOS apps: a long one opens at medium height; pushing its content up
 * grows it to full height first, then the content scrolls; pulling down with the content at
 * the top shrinks it and closes it (a flick closes at once). Short sheets fit their content.
 * Sideways swipes stay with the content (chips), number wheels and sort handles keep their
 * own drag. Built on Radix Dialog for focus trapping, Escape and aria wiring.
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
  fullHeight = false,
  className,
}: SheetProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  // Radix mounts the portal a moment later: effects wait for the element itself.
  const [sheetEl, setSheetEl] = useState<HTMLDivElement | null>(null);
  /** Moved by hand: content arriving later no longer changes the height. */
  const touched = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const setParentCovered = useContext(SheetStackContext);
  const stacked = setParentCovered !== null;
  // How many sheets are open on top of this one (siblings can be open at the same time).
  const [covers, setCovers] = useState(0);
  const covered = covers > 0;
  const setCovered = useCallback((on: boolean) => {
    setCovers((n) => Math.max(0, n + (on ? 1 : -1)));
  }, []);
  const reduceMotion = useReducedMotion();
  /** Offset from full height (px): 0 = full, `medium` = the middle step. */
  const y = useMotionValue(0);
  const medium = useRef<number | null>(null);
  const atMedium = useRef(false);

  useEffect(() => {
    if (!open || !setParentCovered) return;
    setParentCovered(true);
    return () => {
      setParentCovered(false);
    };
  }, [open, setParentCovered]);

  // Covered by another sheet: up to full height behind it (so it peeks out above), back to
  // where it was when the one on top closes.
  const wasMedium = useRef(false);
  useEffect(() => {
    if (!open) return;
    if (covered) {
      wasMedium.current = atMedium.current;
      if (atMedium.current) settle(0);
    } else if (wasMedium.current && medium.current !== null) {
      wasMedium.current = false;
      settle(medium.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to being covered only
  }, [covered]);

  function settle(to: number, velocity = 0) {
    atMedium.current = medium.current !== null && to === medium.current;
    void animate(y, to, reduceMotion ? { duration: 0 } : { ...spring.sheet, velocity });
  }

  // Where the middle step is: only for sheets clearly taller than it, and not with a footer.
  function measure(): number | null {
    const sheet = contentRef.current;
    // A sheet over a sheet (and one with a footer) opens at full height, as before.
    if (!sheet || footer || stacked || fullHeight) return null;
    const height = sheet.offsetHeight;
    const target = window.innerHeight * sheetDetent.medium;
    return height > target + sheetDetent.slack ? height - target : null;
  }

  // Opening: slide in from below to the middle step (or full height).
  useLayoutEffect(() => {
    const sheet = sheetEl;
    if (!open || !sheet) return;
    touched.current = false;
    medium.current = measure();
    y.set(sheet.offsetHeight);
    settle(medium.current ?? 0);
    // Content arriving later changes the height: keep the visible part where it was.
    const observer = new ResizeObserver(() => {
      const next = measure();
      const before = medium.current;
      medium.current = next;
      if (atMedium.current) {
        if (next === null) settle(0);
        else y.set(next);
      } else if (!touched.current && next !== null && before === null) {
        // Grew past the middle step before anyone touched it: open at the middle step.
        settle(next);
      }
    });
    observer.observe(sheet);
    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, [open, sheetEl]);

  // Below full height every vertical move belongs to the sheet: the content stays put.
  useEffect(() => {
    const lock = (offset: number) => {
      const scroller = scrollRef.current;
      if (scroller) scroller.style.overflowY = offset > 0.5 ? 'hidden' : '';
    };
    lock(y.get());
    return y.on('change', lock);
  }, [y, sheetEl]);

  // Typing: full height, so the field is not hidden behind the keyboard.
  useEffect(() => {
    const sheet = sheetEl;
    if (!open || !sheet) return;
    const onFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (atMedium.current && target.matches('input, textarea, [contenteditable="true"]')) {
        settle(0);
      }
    };
    sheet.addEventListener('focusin', onFocus);
    return () => {
      sheet.removeEventListener('focusin', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settle is stable enough
  }, [open, sheetEl]);

  // Touch: grow, shrink, close – or leave it to the content.
  useEffect(() => {
    const sheet = sheetEl;
    if (!open || !sheet) return;
    let g: Gesture | null = null;

    const release = () => {
      if (g?.mode !== 'sheet') {
        g = null;
        return;
      }
      const recent = g.samples.slice(-4);
      const first = recent[0];
      const last = recent.at(-1);
      const dt = first && last ? Math.max(1, last.t - first.t) : 1;
      const velocity = first && last ? ((last.y - first.y) / dt) * 1000 : 0;
      const offset = y.get();
      const mid = medium.current;
      const scrolled = g.scrolled;
      g = null;
      const scroller = scrollRef.current;
      if (scrolled && scroller && offset === 0) {
        // Handed over to the content: let it glide on as a scroll would.
        if (velocity < 0) {
          void animate(scroller.scrollTop, scroller.scrollTop - velocity * 0.35, {
            type: 'inertia',
            velocity: -velocity,
            power: 0.35,
            timeConstant: 325,
            min: 0,
            max: scroller.scrollHeight - scroller.clientHeight,
            onUpdate: (v) => {
              scroller.scrollTop = v;
            },
          });
        }
        return;
      }
      if (velocity > sheetDetent.flick || offset > (mid ?? 0) + sheetDismiss.offset) {
        onOpenChange(false);
      } else if (velocity < -sheetDetent.flick || mid === null || offset < mid / 2) {
        settle(0, velocity);
      } else {
        settle(mid, velocity);
      }
    };

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1) return;
      const target = event.target as Element;
      if (target.closest(OWN_GESTURE)) return;
      g = {
        x: touch.clientX,
        y: touch.clientY,
        from: y.get(),
        anchor: touch.clientY,
        mode: 'undecided',
        samples: [{ y: touch.clientY, t: event.timeStamp }],
        scrolled: false,
      };
    };

    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!g || !touch) return;
      const dx = touch.clientX - g.x;
      const dy = touch.clientY - g.y;
      const scroller = scrollRef.current;
      const inScroller = scroller?.contains(event.target as Node) ?? false;
      const atTop = !inScroller || (scroller?.scrollTop ?? 0) <= 0;
      if (g.mode === 'undecided') {
        // Up while not at full height, or down with the content at its top: the sheet moves.
        const grow = dy < 0 && y.get() > 0;
        const shrink = dy > 0 && atTop;
        const vertical = Math.abs(dy) >= Math.abs(dx);
        if (Math.abs(dx) < sheetDetent.lock && Math.abs(dy) < sheetDetent.lock) {
          // Not decided yet, but keep Safari from starting its own scroll or bounce first.
          if (vertical && (grow || shrink)) event.preventDefault();
          return;
        }
        if (!vertical) {
          g.mode = 'native';
          return;
        }
        g.mode = grow || shrink ? 'sheet' : 'native';
        g.from = y.get();
        g.anchor = touch.clientY;
      }
      if (g.mode !== 'sheet') return;
      event.preventDefault();
      touched.current = true;
      const next = g.from + (touch.clientY - g.anchor);
      if (next < 0) {
        // Full height reached: the rest of the push scrolls the content.
        y.set(0);
        if (scroller) {
          scroller.style.overflowY = '';
          scroller.scrollTop = -next;
          g.scrolled = true;
        }
      } else {
        y.set(next);
      }
      g.samples.push({ y: touch.clientY, t: event.timeStamp });
    };

    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', release);
    sheet.addEventListener('touchcancel', release);
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', release);
      sheet.removeEventListener('touchcancel', release);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers read refs
  }, [open, sheetEl]);

  // Mouse (desktop): drag the handle/header as before.
  function onHeaderPointerDown(event: React.PointerEvent) {
    if (event.pointerType !== 'mouse') return;
    touched.current = true;
    const startY = event.clientY;
    const from = y.get();
    let last = { y: startY, t: event.timeStamp };
    let velocity = 0;
    const move = (e: PointerEvent) => {
      velocity = ((e.clientY - last.y) / Math.max(1, e.timeStamp - last.t)) * 1000;
      last = { y: e.clientY, t: e.timeStamp };
      y.set(Math.max(0, from + e.clientY - startY));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const offset = y.get();
      const mid = medium.current;
      if (velocity > sheetDismiss.velocity || offset > (mid ?? 0) + sheetDismiss.offset) {
        onOpenChange(false);
      } else if (mid === null || offset < mid / 2) settle(0);
      else settle(mid);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
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
                // "Rückgängig" on a toast must not close the sheet.
                onInteractOutside={(event) => {
                  if (
                    event.target instanceof Element &&
                    event.target.closest('[data-toaster]') !== null
                  )
                    event.preventDefault();
                }}
              >
                <motion.div
                  ref={(el) => {
                    contentRef.current = el;
                    setSheetEl(el);
                  }}
                  className={cn(
                    'absolute inset-x-0 bottom-0 flex max-h-(--spacing-sheet-max) origin-top flex-col rounded-t-sheet border-t border-border bg-surface pb-safe outline-none',
                    stacked && 'max-h-(--spacing-sheet-stacked)',
                    className,
                  )}
                  style={{ y }}
                  // Behind another sheet it stays where it is and only shrinks back a little
                  // (dimmed by the new sheet's overlay): calm, no height change.
                  animate={{ scale: covered ? sheetBehindScale : 1 }}
                  exit={{ y: '100%' }}
                  transition={spring.sheet}
                >
                  <div
                    className="shrink-0 cursor-grab px-gutter pt-2 pb-3"
                    onPointerDown={onHeaderPointerDown}
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
                  <div
                    ref={scrollRef}
                    className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter pb-4"
                  >
                    <SheetStackContext.Provider value={setCovered}>
                      {children}
                    </SheetStackContext.Provider>
                  </div>
                  {footer && (
                    <div className="shrink-0 border-t border-border px-gutter pt-3 pb-2">
                      {footer}
                    </div>
                  )}
                  {/* Behind another sheet: dimmed, and lit up again a little slower than the
                      overlay fades, so you notice it was there all along. */}
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-t-sheet bg-overlay"
                    initial={false}
                    animate={{ opacity: covered ? 1 : 0 }}
                    transition={sheetBehind.transition}
                  />
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
