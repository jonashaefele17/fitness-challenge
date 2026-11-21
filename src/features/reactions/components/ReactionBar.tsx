import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { useMemberLookup } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { pressScale, spring } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';
import { Sheet } from '@/shared/ui';
import type { TargetRef } from '@/shared/types/target';
import { useReactionKinds, useReactions, useSetReaction } from '../api/useReactions';

/** How long a press must be to open the choice instead of giving 🔥. */
const LONG_PRESS_MS = 450;

export interface ReactionBarProps {
  target: TargetRef;
}

/**
 * Reactions like iMessage: a tap gives (or takes back) 🔥, a long press offers the others
 * (💪 👏 😂 😮 ❤️). One reaction per person; the totals next to it open who reacted how.
 */
export function ReactionBar({ target }: ReactionBarProps) {
  const kinds = useReactionKinds().data ?? [];
  const reactions = useReactions(target);
  const set = useSetReaction(target);
  const [picking, setPicking] = useState(false);
  const [showWho, setShowWho] = useState(false);
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const mine = reactions.data?.mine ?? null;
  const list = reactions.data?.reactions ?? [];
  const quick = kinds[0];
  const emojiOf = (key: string) => kinds.find((kind) => kind.key === key)?.emoji ?? '🔥';
  const totals = kinds
    .map((kind) => ({ ...kind, count: list.filter((r) => r.kind === kind.key).length }))
    .filter((kind) => kind.count > 0);

  // iOS starts selecting the text around a long press (and offers "Kopieren"): while the
  // finger is down nothing on the page is selectable.
  function lockSelection(locked: boolean) {
    document.documentElement.classList.toggle('select-none', locked);
    if (locked) window.getSelection()?.removeAllRanges();
  }

  function cancelPress() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    lockSelection(false);
  }

  function choose(key: string) {
    setPicking(false);
    set.mutate(mine === key ? null : key);
  }

  return (
    <div className="relative flex items-center gap-1">
      <motion.button
        type="button"
        aria-pressed={mine !== null}
        aria-label={mine ? 'Reaktion zurücknehmen' : 'Reagieren (lange drücken für mehr)'}
        whileTap={{ scale: pressScale }}
        transition={spring.press}
        disabled={reactions.isPending || !quick}
        onPointerDown={() => {
          longPressed.current = false;
          cancelPress();
          lockSelection(true);
          timer.current = window.setTimeout(() => {
            longPressed.current = true;
            window.getSelection()?.removeAllRanges();
            setPicking(true);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          if (quick) set.mutate(mine ? null : quick.key);
        }}
        className={cn(
          'flex size-tap items-center justify-center rounded-pill text-title-3 transition-colors duration-(--duration-fast) select-none [-webkit-touch-callout:none]',
          mine ? 'bg-surface-3' : 'active:bg-surface-2',
        )}
      >
        <motion.span
          key={mine ?? 'none'}
          aria-hidden
          initial={mine ? { scale: 0.6 } : false}
          animate={{ scale: 1 }}
          transition={spring.snappy}
          className={cn(!mine && 'opacity-50 grayscale')}
        >
          {mine ? emojiOf(mine) : (quick?.emoji ?? '🔥')}
        </motion.span>
      </motion.button>

      {totals.length > 0 && (
        <button
          type="button"
          aria-label="Wer hat reagiert?"
          onClick={() => {
            setShowWho(true);
          }}
          className="flex min-h-tap items-center gap-2 rounded-pill px-2 text-subhead font-semibold text-text-muted active:bg-surface-2"
        >
          {totals.map((kind) => (
            <span key={kind.key} className="flex items-center gap-0.5 tabular-nums">
              <span aria-hidden>{kind.emoji}</span>
              {kind.count}
            </span>
          ))}
        </button>
      )}

      <AnimatePresence>
        {picking && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-30"
              onClick={() => {
                setPicking(false);
              }}
            />
            <motion.div
              key="picker"
              role="menu"
              aria-label="Reaktion wählen"
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 8 }}
              transition={spring.snappy}
              className="absolute bottom-full left-0 z-40 mb-2 flex origin-bottom-left items-center gap-1 rounded-pill glass p-1"
            >
              {kinds.map((kind) => (
                <button
                  key={kind.key}
                  type="button"
                  role="menuitem"
                  aria-label={kind.emoji}
                  onClick={() => {
                    choose(kind.key);
                  }}
                  className={cn(
                    'flex size-tap items-center justify-center rounded-pill text-title-2 active:scale-110',
                    mine === kind.key && 'bg-surface-3',
                  )}
                >
                  {kind.emoji}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <WhoReacted
        open={showWho}
        onOpenChange={setShowWho}
        groupId={target.groupId}
        reactions={list.map((reaction) => ({ ...reaction, emoji: emojiOf(reaction.kind) }))}
      />
    </div>
  );
}

function WhoReacted({
  open,
  onOpenChange,
  groupId,
  reactions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  reactions: { userId: string; emoji: string }[];
}) {
  const member = useMemberLookup(groupId);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Reaktionen">
      <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        {reactions.map((reaction) => {
          const person = member(reaction.userId);
          return (
            <li key={reaction.userId} className="flex min-h-tap items-center gap-3 px-4 py-2">
              {person && <Avatar profile={person} size="sm" />}
              <span className="min-w-0 flex-1 truncate text-body">
                {person?.displayName ?? 'Jemand'}
              </span>
              <span aria-hidden className="text-title-3">
                {reaction.emoji}
              </span>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
