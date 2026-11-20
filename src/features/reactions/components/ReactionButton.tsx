import { AnimatePresence, motion } from 'motion/react';
import { pressScale, spring } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';
import type { TargetRef } from '@/shared/types/target';
import { useReactions, useToggleReaction } from '../api/useReactions';

export interface ReactionButtonProps {
  target: TargetRef;
}

/** 🔥 with count. Tapping toggles my reaction instantly (optimistic). */
export function ReactionButton({ target }: ReactionButtonProps) {
  const reactions = useReactions(target);
  const toggle = useToggleReaction(target);
  const count = reactions.data?.count ?? 0;
  const mine = reactions.data?.mine ?? false;

  return (
    <motion.button
      type="button"
      aria-pressed={mine}
      aria-label={mine ? 'Feuer zurücknehmen' : 'Feuer geben'}
      whileTap={{ scale: pressScale }}
      transition={spring.press}
      disabled={reactions.isPending}
      onClick={() => {
        toggle.mutate(!mine);
      }}
      className={cn(
        'flex min-h-tap items-center gap-1.5 rounded-pill px-3 text-subhead font-semibold transition-colors duration-(--duration-fast)',
        mine ? 'bg-surface-3 text-text' : 'text-text-muted active:bg-surface-2',
      )}
    >
      <motion.span
        key={mine ? 'on' : 'off'}
        aria-hidden
        initial={mine ? { scale: 0.6 } : false}
        animate={{ scale: 1 }}
        transition={spring.snappy}
        className={cn(!mine && 'opacity-50 grayscale')}
      >
        🔥
      </motion.span>
      <AnimatePresence mode="popLayout" initial={false}>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={spring.snappy}
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
