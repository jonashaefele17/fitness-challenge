import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib';
import {
  Button,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SpeakerIcon,
  SpeakerOffIcon,
} from '@/shared/ui';
import { useUpdateSet } from '../../api/useWorkout';
import { firstOpenStep, routineSteps, type RoutineStep } from '../../routine';
import type { WorkoutItem } from '../../types';
import { TrainingTypeIcon } from '../TrainingTypeIcon';

const SOUND_KEY = 'routine.sound';
const TICK_MS = 200;
/** Ring geometry (SVG units). */
const RING_R = 88;
const RING_C = 2 * Math.PI * RING_R;

function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Square-wave level: clearly audible over gym noise without clipping. */
const BEEP_LEVEL = 0.5;

/** Short beeps from Web Audio (no files); only while the app is in the foreground. */
function useBeeper(enabled: boolean) {
  const context = useRef<AudioContext | null>(null);
  return {
    /** Must run inside a tap (iOS only allows audio after a user gesture). */
    unlock() {
      // iOS 17+: play like media, so beeps sound even with the ring/silent switch on.
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'playback';
      context.current ??= new AudioContext();
      void context.current.resume();
    },
    beep(frequency: number, seconds: number) {
      const ctx = context.current;
      if (!enabled || !ctx) return;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      // Square wave around 1-2 kHz: where a phone speaker is loudest. Short attack (no click),
      // full level for most of the beep, then a quick fade.
      const now = ctx.currentTime;
      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(BEEP_LEVEL, now + 0.005);
      gain.gain.setValueAtTime(BEEP_LEVEL, now + seconds * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + seconds);
    },
  };
}

/** Keeps the screen on while the routine runs (re-acquired when the app comes back). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      navigator.wakeLock.request('screen').then(
        (sentinel) => {
          lock = sentinel;
        },
        () => undefined,
      );
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}

interface Clock {
  index: number;
  /** When the current step ends (ms), while running. */
  endsAt: number;
  /** Remaining ms while paused, else null. */
  pausedRemaining: number | null;
}

/**
 * Guided routine (Mobility): exercise and side, a countdown ring, rest, what comes next.
 * Runs on wall-clock time, so coming back to the app lands on the right step; each
 * finished exercise round is saved as a set with its duration.
 */
export function RoutinePlayer({
  items,
  onFinish,
  finishing,
}: {
  items: WorkoutItem[];
  onFinish: () => void;
  finishing: boolean;
}) {
  const steps = routineSteps(items);
  const update = useUpdateSet();
  const [sound, setSound] = useState(readSound);
  const beeper = useBeeper(sound);
  const [clock, setClockState] = useState<Clock | null>(null);
  // The interval reads the latest clock and steps without re-subscribing.
  const clockRef = useRef<Clock | null>(null);
  const stepsRef = useRef(steps);
  useEffect(() => {
    stepsRef.current = steps;
  });
  function setClock(next: Clock | null) {
    clockRef.current = next;
    setClockState(next);
  }
  const [now, setNow] = useState(() => Date.now());
  const lastBeep = useRef<number | null>(null);
  const done = new Set(
    items.flatMap((item) => item.sets.filter((set) => set.completedAt).map((set) => set.id)),
  );
  const startIndex = firstOpenStep(steps, done);
  const running = clock !== null && clock.pausedRemaining === null && clock.index < steps.length;
  useWakeLock(running);

  function save(step: RoutineStep, at: number) {
    if (step.kind !== 'exercise' || !step.setId) return;
    update.mutate({
      itemId: step.itemId,
      setId: step.setId,
      changes: { durationSeconds: step.seconds, completedAt: new Date(at).toISOString() },
    });
  }

  // Advance on time (several steps at once after coming back from the background).
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const current = clockRef.current;
      const list = stepsRef.current;
      if (!current || current.pausedRemaining !== null) return;
      let { index, endsAt } = current;
      while (index < list.length && endsAt <= t) {
        const step = list[index];
        if (step) save(step, endsAt);
        index += 1;
        const next = list[index];
        if (next) endsAt += next.seconds * 1000;
        beeper.beep(index < list.length ? 1500 : 2000, 0.4);
      }
      if (index !== current.index) setClock({ index, endsAt, pausedRemaining: null });
    }, TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
    // save/beeper are recreated each render; the interval only needs to restart on run/pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const index = clock?.index ?? startIndex;
  const step = steps[index];
  const remainingMs =
    clock === null || !step
      ? (step?.seconds ?? 0) * 1000
      : (clock.pausedRemaining ?? Math.max(0, clock.endsAt - now));
  const remaining = Math.ceil(remainingMs / 1000);

  // Count down the last five seconds.
  useEffect(() => {
    if (!running || remaining > 5 || remaining < 1 || lastBeep.current === remaining) return;
    lastBeep.current = remaining;
    beeper.beep(1000, 0.15);
  }, [running, remaining, beeper]);

  function start() {
    beeper.unlock();
    const first = steps[startIndex];
    if (!first) return;
    setClock({
      index: startIndex,
      endsAt: Date.now() + first.seconds * 1000,
      pausedRemaining: null,
    });
  }

  function togglePause() {
    beeper.unlock();
    const current = clockRef.current;
    if (!current) return;
    const t = Date.now();
    setClock(
      current.pausedRemaining === null
        ? { ...current, pausedRemaining: Math.max(0, current.endsAt - t) }
        : { ...current, endsAt: t + current.pausedRemaining, pausedRemaining: null },
    );
  }

  function jump(to: number) {
    const base = clockRef.current ?? { index: startIndex, endsAt: 0, pausedRemaining: null };
    const target = Math.max(0, Math.min(steps.length, to));
    const ms = (steps[target]?.seconds ?? 0) * 1000;
    setClock(
      base.pausedRemaining === null
        ? { index: target, endsAt: Date.now() + ms, pausedRemaining: null }
        : { index: target, endsAt: 0, pausedRemaining: ms },
    );
  }

  function shift(seconds: number) {
    const current = clockRef.current;
    if (!current) return;
    setClock(
      current.pausedRemaining === null
        ? { ...current, endsAt: current.endsAt + seconds * 1000 }
        : {
            ...current,
            pausedRemaining: Math.max(1000, current.pausedRemaining + seconds * 1000),
          },
    );
  }

  const finished = index >= steps.length;
  const nextExercise = steps.slice(index + 1).find((s) => s.kind === 'exercise');
  const progress = step ? 1 - remainingMs / (step.seconds * 1000) : 1;
  const sideLabel = step?.side === 'left' ? 'Links' : step?.side === 'right' ? 'Rechts' : null;

  if (steps.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-gutter text-center">
        <p className="text-subhead text-text-muted">
          Diese Routine hat noch keine Übungen mit Zeit. Lege sie unter Training → Vorlagen an.
        </p>
        <Button onClick={onFinish} loading={finishing}>
          Beenden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-between gap-4 px-gutter pt-2 pb-4">
      <div className="flex w-full items-center justify-between">
        <span className="text-footnote text-text-muted tabular-nums">
          {finished ? 'Geschafft' : `Schritt ${String(index + 1)} von ${String(steps.length)}`}
        </span>
        <button
          type="button"
          aria-label={sound ? 'Töne aus' : 'Töne an'}
          aria-pressed={sound}
          onClick={() => {
            setSound((on) => {
              try {
                localStorage.setItem(SOUND_KEY, on ? '0' : '1');
              } catch {
                // Remembering is a convenience only.
              }
              return !on;
            });
          }}
          className="flex size-tap items-center justify-center rounded-pill text-title-3 text-text-muted active:bg-surface-2"
        >
          {sound ? <SpeakerIcon /> : <SpeakerOffIcon />}
        </button>
      </div>

      {finished ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <TrainingTypeIcon icon="mobility" className="size-16 text-accent" />
          <p className="text-title-2 font-semibold">Routine geschafft!</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex flex-col items-center gap-1">
            <h2
              className={cn(
                'text-title-1 font-semibold',
                step?.kind === 'rest' && 'text-text-muted',
              )}
            >
              {step?.name}
            </h2>
            <span className="text-subhead text-text-muted">
              {[
                sideLabel,
                step && step.rounds > 1
                  ? `Runde ${String(step.round)}/${String(step.rounds)}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>

          <div className="relative flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="size-64 -rotate-90" aria-hidden>
              <circle
                cx="100"
                cy="100"
                r={RING_R}
                className="stroke-surface-3"
                strokeWidth="10"
                fill="none"
              />
              <circle
                cx="100"
                cy="100"
                r={RING_R}
                className={step?.kind === 'rest' ? 'stroke-text-subtle' : 'stroke-accent'}
                strokeWidth="10"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={RING_C}
                // Glide between the 200 ms updates instead of jumping.
                style={{ transition: `stroke-dashoffset ${String(TICK_MS)}ms linear` }}
                strokeDashoffset={RING_C * Math.min(1, Math.max(0, progress))}
              />
            </svg>
            <span aria-live="off" className="absolute text-large-title font-semibold tabular-nums">
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </span>
          </div>

          <span className="text-footnote text-text-muted">
            {nextExercise ? `Als Nächstes: ${nextExercise.name}` : 'Letzte Übung'}
          </span>
        </div>
      )}

      {finished ? (
        <Button size="lg" fullWidth onClick={onFinish} loading={finishing}>
          Beenden ✓
        </Button>
      ) : clock === null ? (
        <Button size="lg" fullWidth onClick={start}>
          {startIndex > 0 ? 'Weiter' : 'Los geht’s'}
        </Button>
      ) : (
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-center gap-6">
            <button
              type="button"
              aria-label="Zurück"
              onClick={() => {
                jump(index - 1);
              }}
              className="flex size-14 items-center justify-center rounded-pill text-title-2 text-text active:bg-surface-2"
            >
              <SkipBackIcon />
            </button>
            <button
              type="button"
              aria-label={clock.pausedRemaining === null ? 'Pause' : 'Weiter'}
              onClick={togglePause}
              className="flex size-20 items-center justify-center rounded-pill bg-accent text-title-1 text-on-accent active:bg-accent-pressed"
            >
              {clock.pausedRemaining === null ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              aria-label="Überspringen"
              onClick={() => {
                jump(index + 1);
              }}
              className="flex size-14 items-center justify-center rounded-pill text-title-2 text-text active:bg-surface-2"
            >
              <SkipForwardIcon />
            </button>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                shift(-10);
              }}
            >
              −10 s
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                shift(10);
              }}
            >
              +10 s
            </Button>
            <Button variant="ghost" onClick={onFinish} loading={finishing}>
              Beenden
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
