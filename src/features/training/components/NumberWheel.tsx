import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react';
import { useState } from 'react';
import { cn, hapticTick } from '@/shared/lib';

/** Height of one value row in px (the wheel's step distance). */
const ITEM_PX = 30;
/** Values rendered above and below the current one. */
const RANGE = 40;

export interface NumberWheelProps {
  value: number | null;
  /** Shown greyed out (suggested from the last set/workout, not yet confirmed). */
  suggested: boolean;
  step: number;
  label: string;
  format: (value: number) => string;
  parse: (text: string) => number;
  onChange: (value: number) => void;
}

/**
 * iOS-style number wheel: the column follows the finger, neighbours fade in above and below,
 * a flick keeps spinning with momentum and snaps to the nearest step. Tap to type instead.
 * Swipe up increases the value.
 */
export function NumberWheel({
  value,
  suggested,
  step,
  label,
  format,
  parse,
  onChange,
}: NumberWheelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [spinning, setSpinning] = useState(false);
  const reduceMotion = useReducedMotion();
  const base = value ?? 0;
  const y = useMotionValue(0);
  // Steps we may go down before reaching 0.
  const minIndex = -Math.floor(base / step + 1e-9);

  const round = (n: number) => Math.round(n * 100) / 100;
  const indexAt = (offset: number) => Math.round(-offset / ITEM_PX);
  const [lastIndex, setLastIndex] = useState(0);

  useMotionValueEvent(y, 'change', (latest) => {
    const index = indexAt(latest);
    if (index !== lastIndex) {
      setLastIndex(index);
      hapticTick();
    }
  });

  function settle(velocity: number) {
    const clampIndex = (index: number) => Math.min(RANGE, Math.max(minIndex, index));
    const commit = () => {
      const index = clampIndex(indexAt(y.get()));
      setSpinning(false);
      y.set(0);
      setLastIndex(0);
      if (index !== 0) onChange(round(base + index * step));
    };
    if (reduceMotion) {
      commit();
      return;
    }
    void animate(y, 0, {
      type: 'inertia',
      velocity,
      power: 0.25,
      timeConstant: 180,
      modifyTarget: (target) => -clampIndex(indexAt(target)) * ITEM_PX,
      onComplete: commit,
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        aria-label={label}
        inputMode="decimal"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          const parsed = parse(draft);
          if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className="h-wheel w-16 rounded-sm bg-surface-3 text-center text-body tabular-nums focus:outline-none"
      />
    );
  }

  const items = [];
  for (let index = Math.max(minIndex, -RANGE); index <= RANGE; index++) {
    items.push(index);
  }

  return (
    <div
      role="spinbutton"
      aria-label={label}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value === null ? 'leer' : format(value)}
      data-wheel
      className={cn(
        'relative h-wheel w-16 touch-none overflow-hidden rounded-sm wheel-mask select-none',
        spinning && 'bg-surface-3',
      )}
    >
      <motion.div
        className="absolute inset-x-0 top-1/2"
        style={{ y }}
        drag="y"
        dragMomentum={false}
        dragElastic={0.15}
        onDragStart={() => {
          setSpinning(true);
        }}
        onDragEnd={(_, info) => {
          settle(info.velocity.y);
        }}
        onTap={() => {
          if (spinning) return;
          setDraft(value === null ? '' : format(value));
          setEditing(true);
        }}
      >
        {items.map((index) => (
          <div
            key={index}
            className={cn(
              'absolute inset-x-0 flex items-center justify-center tabular-nums',
              index === lastIndex
                ? cn('text-body font-semibold', suggested && !spinning && 'text-text-muted')
                : 'text-subhead text-text-subtle',
            )}
            style={{ height: ITEM_PX, top: index * ITEM_PX - ITEM_PX / 2 }}
          >
            {value === null && index === 0 ? '–' : format(round(base + index * step))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
