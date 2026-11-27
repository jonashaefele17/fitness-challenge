import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react';
import { useLayoutEffect, useState } from 'react';
import { cn, hapticTick } from '@/shared/lib';

/** Height of one value row in px (the wheel's step distance). */
const ITEM_PX = 30;
/** Values rendered above and below the current one. */
const RANGE = 40;
/** How far a flick carries (s): target = offset + velocity × power. */
const INERTIA_POWER = 0.25;

export interface NumberWheelProps {
  value: number | null;
  /** Shown greyed out (suggested from the last set/workout, not yet confirmed). */
  suggested: boolean;
  step: number;
  label: string;
  format: (value: number) => string;
  parse: (text: string) => number;
  onChange: (value: number) => void;
  /** Ignore touches (e.g. while the row's delete button is open), so the row can be swiped. */
  disabled?: boolean;
  /**
   * Where an empty wheel starts rolling from (it still shows "–" until moved). Without it
   * an empty wheel starts at 0, which is useless for values like a body weight.
   */
  emptyStart?: number;
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
  disabled = false,
  emptyStart = 0,
}: NumberWheelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [spinning, setSpinning] = useState(false);
  const reduceMotion = useReducedMotion();
  // While a gesture (and its roll-out) runs, the column stays anchored to the value it
  // started from, even if the new value already arrived from outside. Afterwards it re-bases.
  const [anchor, setAnchor] = useState<number | null>(null);
  const base = anchor ?? value ?? emptyStart;
  const y = useMotionValue(0);
  // Steps we may go down before reaching 0.
  const minIndex = -Math.floor(base / step + 1e-9);

  const round = (n: number) => Math.round(n * 100) / 100;
  const indexAt = (offset: number) => Math.round(-offset / ITEM_PX);
  const clampIndex = (index: number) => Math.min(RANGE, Math.max(minIndex, index));
  const [lastIndex, setLastIndex] = useState(0);

  useMotionValueEvent(y, 'change', (latest) => {
    const index = indexAt(latest);
    if (index !== lastIndex) {
      setLastIndex(index);
      hapticTick();
    }
  });

  // Re-base without a visible jump: once the anchor is released, the column shows the new
  // value at offset 0 before the browser paints.
  useLayoutEffect(() => {
    if (anchor === null) y.set(0);
  }, [anchor, y]);

  function startGesture() {
    setSpinning(true);
    // Grabbing a still-rolling wheel continues from where it is.
    setAnchor((current) => current ?? value ?? emptyStart);
  }

  function settle(velocity: number) {
    // Decide the target right away (same projection the roll-out uses) and report it
    // immediately, so ticking the set during the roll-out already saves the new number.
    const targetIndex = clampIndex(indexAt(y.get() + velocity * INERTIA_POWER));
    const target = round(base + targetIndex * step);
    if (targetIndex !== 0 && target !== value) onChange(target);
    const release = () => {
      setSpinning(false);
      setLastIndex(0);
      setAnchor(null);
    };
    if (reduceMotion) {
      release();
      return;
    }
    void animate(y, -targetIndex * ITEM_PX, {
      type: 'inertia',
      velocity,
      power: INERTIA_POWER,
      timeConstant: 180,
      modifyTarget: () => -targetIndex * ITEM_PX,
      onComplete: release,
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
      data-wheel={disabled ? undefined : ''}
      aria-disabled={disabled || undefined}
      className={cn(
        'relative h-wheel w-16 overflow-hidden rounded-sm wheel-mask select-none',
        disabled ? 'pointer-events-none' : 'touch-none',
        spinning && 'bg-surface-3',
      )}
    >
      <motion.div
        className="absolute inset-x-0 top-1/2"
        style={{ y }}
        drag="y"
        dragMomentum={false}
        dragElastic={0.15}
        onDragStart={startGesture}
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
