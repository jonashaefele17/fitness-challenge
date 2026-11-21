import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { spring } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';

export interface PickerPerson {
  id: string;
  name: string;
  color: string;
}

/** Delay between avatars popping out (s). */
const STAGGER_S = 0.04;

/**
 * "Gruppe" as a glass pill that unfolds in place (iOS 26 style): tap it and the group's
 * avatars pop out one after another; tap an avatar to show or hide that person, tap
 * anywhere else to fold it back. Closed, it shows the avatars of the people shown.
 */
export function GroupPicker({
  people,
  shownIds,
  onToggle,
  open,
  onOpenChange: setOpen,
}: {
  people: PickerPerson[];
  shownIds: string[];
  onToggle: (personId: string) => void;
  /** Held by the parent, so the pill stays open when the view below switches. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const shown = people.filter((person) => shownIds.includes(person.id));

  // Fold back on a tap outside.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
    };
  }, [open, setOpen]);

  return (
    <div ref={root} className="relative flex h-tap shrink-0 items-center justify-end">
      <button
        type="button"
        aria-expanded={open}
        aria-label={
          shown.length > 0
            ? `Angezeigt: ${shown.map((person) => person.name).join(', ')} – ändern`
            : 'Gruppe anzeigen'
        }
        onClick={() => {
          setOpen(true);
        }}
        className={cn(
          'flex min-h-tap items-center gap-2 rounded-pill glass px-3 text-subhead font-semibold',
          open && 'invisible',
        )}
      >
        {shown.length > 0 && (
          <span aria-hidden className="flex -space-x-1.5">
            {shown.slice(0, 4).map((person) => (
              <Avatar key={person.id} person={person} className="size-6 text-caption" />
            ))}
          </span>
        )}
        Gruppe
      </button>

      {/* No entry animation when the pill is re-created already open (view switch). */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            role="group"
            aria-label="Wen anzeigen"
            className="absolute top-0 right-0 z-10 no-scrollbar flex h-tap max-w-[calc(100vw-2*var(--spacing-gutter))] items-center gap-1 overflow-x-auto rounded-pill glass px-1.5"
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, clipPath: 'inset(0 0 0 70% round 999px)' }
            }
            animate={
              reduceMotion
                ? { opacity: 1 }
                : { opacity: 1, clipPath: 'inset(0 0 0 0% round 999px)' }
            }
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, clipPath: 'inset(0 0 0 70% round 999px)' }
            }
            transition={spring.snappy}
          >
            <span className="shrink-0 pr-1 pl-2.5 text-footnote font-semibold text-text-muted">
              Mit
            </span>
            {people.map((person, index) => {
              const on = shownIds.includes(person.id);
              return (
                <motion.button
                  key={person.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={person.name}
                  onClick={() => {
                    onToggle(person.id);
                  }}
                  className="flex size-tap shrink-0 items-center justify-center"
                  initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                  animate={{ scale: on ? 1 : 0.85, opacity: 1 }}
                  transition={{ ...spring.pop, delay: reduceMotion ? 0 : index * STAGGER_S }}
                >
                  <Avatar
                    person={person}
                    className={cn(
                      'size-8 text-footnote transition-[filter,opacity] duration-(--duration-fast)',
                      on ? 'ring-2 ring-text' : 'opacity-40 grayscale',
                    )}
                  />
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar({ person, className }: { person: PickerPerson; className?: string }) {
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-pill border-2 border-surface font-semibold text-on-accent',
        className,
      )}
      style={{ backgroundColor: person.color }}
    >
      {person.name.charAt(0).toUpperCase()}
    </span>
  );
}
