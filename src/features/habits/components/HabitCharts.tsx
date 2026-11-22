import { useState } from 'react';
import { cn } from '@/shared/lib';
import { addDays, formatMinutes } from '../dates';
import { valueText } from '../habitText';
import { nightAxis, nightClock, rel } from '../nights';
import type { HabitDay, HabitDefinition, HabitWeek } from '../types';

const dayLabel = new Intl.DateTimeFormat('de', {
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
});
const fmt = (day: string) => dayLabel.format(new Date(`${day}T12:00:00`));

/** The line above a chart: what was tapped, or a hint. */
function Readout({ text }: { text: string | null }) {
  return (
    <p className="min-h-5 text-footnote text-text-muted tabular-nums" aria-live="polite">
      {text ?? 'Antippen für Werte'}
    </p>
  );
}

const STATE_FILL: Record<string, string> = {
  done: 'var(--color-accent)',
  partial: 'color-mix(in oklab, var(--color-accent) 45%, var(--color-surface-3))',
  missed: 'var(--color-surface-3)',
  open: 'var(--color-surface-3)',
};
const STATE_TEXT: Record<string, string> = {
  done: 'erfüllt',
  partial: 'teilweise',
  missed: 'verfehlt',
  open: 'offen',
  paused: 'Pause',
};

/**
 * Day by day, as a calendar: weeks as columns, Monday on top. Met = accent, partly = paler,
 * missed = grey, pause = outline only, not due = empty.
 */
export function HabitHeatmap({
  days,
  def,
  from,
  to,
}: {
  days: HabitDay[];
  def: HabitDefinition;
  from: string;
  to: string;
}) {
  const [picked, setPicked] = useState<HabitDay | null>(null);
  const start = addDays(from, -((new Date(`${from}T12:00:00`).getDay() + 6) % 7));
  const cells: string[] = [];
  for (let d = start; d <= to; d = addDays(d, 1)) cells.push(d);
  const columns = Math.ceil(cells.length / 7);
  // Fixed small squares (the grid does not stretch with few weeks).
  const size = 18;
  const gap = 4;
  const width = columns * (size + gap);
  const height = 7 * (size + gap);
  return (
    <div className="flex flex-col gap-2">
      <Readout
        text={
          picked
            ? `${fmt(picked.onDate)} · ${picked.state ? (STATE_TEXT[picked.state] ?? '') : 'nicht fällig'}${
                picked.value && def.inputType !== 'yes_no'
                  ? ` · ${valueText(def, picked.value) ?? ''}`
                  : ''
              }`
            : null
        }
      />
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        width={width}
        height={height}
        className="max-w-full"
        role="img"
        aria-label="Tage im Zeitraum"
      >
        {cells.map((day, index) => {
          const entry = days.find((d) => d.onDate === day);
          const x = Math.floor(index / 7) * (size + gap);
          const y = (index % 7) * (size + gap);
          const state = entry?.state ?? null;
          if (day < from || !entry) return null;
          return (
            <rect
              key={day}
              x={x}
              y={y}
              width={size}
              height={size}
              rx={4}
              fill={state && state !== 'paused' ? STATE_FILL[state] : 'transparent'}
              stroke={
                state === 'paused'
                  ? 'var(--color-text-subtle)'
                  : picked?.onDate === day
                    ? 'var(--color-text)'
                    : 'transparent'
              }
              strokeDasharray={state === 'paused' ? '2 2' : undefined}
              strokeWidth={1.5}
              opacity={state ? 1 : 0.25}
              onClick={() => {
                setPicked(entry);
              }}
              className="cursor-pointer"
            />
          );
        })}
      </svg>
      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-caption text-text-muted">
      {(['done', 'partial', 'missed'] as const).map((state) => (
        <span key={state} className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm" style={{ background: STATE_FILL[state] }} />
          {STATE_TEXT[state]}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="size-2.5 rounded-sm border border-dashed border-text-subtle" />
        Pause
      </span>
    </div>
  );
}

/** Numbers and durations: a line through the days, the target as a band. */
export function HabitLine({ days, def }: { days: HabitDay[]; def: HabitDefinition }) {
  const [picked, setPicked] = useState<number | null>(null);
  const valueOf = (d: HabitDay): number | null =>
    d.value && 'minutes' in d.value
      ? d.value.minutes
      : d.value && 'value' in d.value
        ? d.value.value
        : null;
  const points = days.filter((d) => !d.paused);
  const values = points.map(valueOf);
  const condition = def.rule[0];
  const target = condition ? Number(condition.value) : null;
  const known = values.filter((v): v is number => v !== null);
  const max = Math.max(...known, target ?? 0, 1) * 1.15;
  const w = 320;
  const h = 140;
  const pad = 6;
  const xAt = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, points.length - 1);
  const yAt = (v: number) => h - pad - (v / max) * (h - 2 * pad);
  const show = (v: number) =>
    def.inputType === 'duration'
      ? formatMinutes(v)
      : `${v.toLocaleString('de')}${def.unit ? ` ${def.unit}` : ''}`;
  // The line breaks where a day has no value.
  const segments: string[] = [];
  let current = '';
  values.forEach((v, i) => {
    if (v === null) {
      if (current) segments.push(current);
      current = '';
    } else current += `${current ? 'L' : 'M'}${String(xAt(i))},${String(yAt(v))}`;
  });
  if (current) segments.push(current);
  const band =
    target === null
      ? null
      : condition?.op === 'max'
        ? { y: yAt(target), height: h - pad - yAt(target) }
        : { y: pad, height: yAt(target) - pad };
  const pickedPoint = picked !== null ? points[picked] : undefined;
  const pickedValue = picked !== null ? values[picked] : undefined;
  return (
    <div className="flex flex-col gap-2">
      <Readout
        text={
          pickedPoint
            ? `${fmt(pickedPoint.onDate)} · ${pickedValue !== null && pickedValue !== undefined ? show(pickedValue) : 'kein Wert'}`
            : target !== null
              ? `Ziel: ${condition?.op === 'max' ? 'höchstens' : 'mindestens'} ${show(target)}`
              : null
        }
      />
      <svg
        viewBox={`0 0 ${String(w)} ${String(h)}`}
        className="w-full"
        role="img"
        aria-label="Verlauf"
      >
        {band && (
          <rect
            x={0}
            y={band.y}
            width={w}
            height={Math.max(0, band.height)}
            fill="color-mix(in oklab, var(--color-accent) 12%, transparent)"
          />
        )}
        {target !== null && (
          <line
            x1={0}
            x2={w}
            y1={yAt(target)}
            y2={yAt(target)}
            stroke="var(--color-accent)"
            strokeOpacity={0.5}
            strokeDasharray="4 4"
          />
        )}
        {segments.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}
        {values.map((v, i) =>
          v === null ? null : (
            <circle
              key={points[i]?.onDate}
              cx={xAt(i)}
              cy={yAt(v)}
              r={picked === i ? 5 : 3}
              fill="var(--color-accent)"
              stroke="var(--color-surface-2)"
              strokeWidth={2}
            />
          ),
        )}
        {/* Wide tap targets, one per day. */}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.onDate}`}
            x={xAt(i) - w / Math.max(1, points.length) / 2}
            y={0}
            width={w / Math.max(1, points.length)}
            height={h}
            fill="transparent"
            onClick={() => {
              setPicked(i);
            }}
          />
        ))}
      </svg>
    </div>
  );
}

/** A day's number or minutes, if shared. */
function valueOf(d: HabitDay | undefined): number | null {
  return d?.value && 'minutes' in d.value
    ? d.value.minutes
    : d?.value && 'value' in d.value
      ? d.value.value
      : null;
}

/**
 * Numbers and durations of several people: a line each in their colour on one axis.
 * The target only when everyone has the same one. A tap shows everyone's value that day.
 */
export function HabitLines({
  series,
  def,
  dates,
}: {
  series: { id: string; name: string; color: string; days: HabitDay[]; target: number | null }[];
  def: HabitDefinition;
  dates: string[];
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const rows = series.map((s) => ({
    ...s,
    values: dates.map((date) => {
      const day = s.days.find((d) => d.onDate === date);
      return day?.paused ? null : valueOf(day);
    }),
  }));
  const targets = [...new Set(series.map((s) => s.target))];
  const target = targets.length === 1 ? (targets[0] ?? null) : null;
  const known = rows.flatMap((r) => r.values.filter((v): v is number => v !== null));
  const max = Math.max(...known, target ?? 0, 1) * 1.15;
  const w = 320;
  const h = 140;
  const pad = 6;
  const xAt = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, dates.length - 1);
  const yAt = (v: number) => h - pad - (v / max) * (h - 2 * pad);
  const show = (v: number) =>
    def.inputType === 'duration'
      ? formatMinutes(v)
      : `${v.toLocaleString('de')}${def.unit ? ` ${def.unit}` : ''}`;
  const pickedDate = picked !== null ? dates[picked] : undefined;
  return (
    <div className="flex flex-col gap-2">
      <Readout
        text={
          pickedDate && picked !== null
            ? `${fmt(pickedDate)} · ${rows
                .map((r) => {
                  const v = r.values[picked];
                  return `${r.name} ${v === null || v === undefined ? '–' : show(v)}`;
                })
                .join(' · ')}`
            : target !== null
              ? `Ziel für alle: ${show(target)}`
              : null
        }
      />
      <svg
        viewBox={`0 0 ${String(w)} ${String(h)}`}
        className="w-full"
        role="img"
        aria-label="Verlauf im Vergleich"
      >
        {target !== null && (
          <line
            x1={0}
            x2={w}
            y1={yAt(target)}
            y2={yAt(target)}
            stroke="var(--color-text-subtle)"
            strokeDasharray="4 4"
          />
        )}
        {pickedDate && picked !== null && (
          <line x1={xAt(picked)} x2={xAt(picked)} y1={0} y2={h} stroke="var(--color-border)" />
        )}
        {rows.map((r) => {
          const segments: string[] = [];
          let current = '';
          r.values.forEach((v, i) => {
            if (v === null) {
              if (current) segments.push(current);
              current = '';
            } else current += `${current ? 'L' : 'M'}${String(xAt(i))},${String(yAt(v))}`;
          });
          if (current) segments.push(current);
          return (
            <g key={r.id}>
              {segments.map((d) => (
                <path
                  key={d}
                  d={d}
                  fill="none"
                  stroke={r.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              ))}
              {picked !== null && r.values[picked] != null && (
                <circle
                  cx={xAt(picked)}
                  cy={yAt(r.values[picked] ?? 0)}
                  r={4}
                  fill={r.color}
                  stroke="var(--color-surface-2)"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}
        {dates.map((date, i) => (
          <rect
            key={`hit-${date}`}
            x={xAt(i) - w / Math.max(1, dates.length) / 2}
            y={0}
            width={w / Math.max(1, dates.length)}
            height={h}
            fill="transparent"
            onClick={() => {
              setPicked(i);
            }}
          />
        ))}
      </svg>
    </div>
  );
}

/**
 * Sleep: one bar per night from bed to getting up; the latest bed time as a line.
 * For comparing: in a person's colour, on an axis shared with the others, lower.
 */
export function HabitNights({
  days,
  def,
  color = 'var(--color-accent)',
  axis,
  compact = false,
}: {
  days: HabitDay[];
  def: HabitDefinition;
  color?: string;
  axis?: { lo: number; hi: number };
  compact?: boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const nights = days.filter((d) => !d.paused);
  const pairs = nights.map((d) =>
    d.value && 'start' in d.value ? { a: rel(d.value.start), b: rel(d.value.end) } : null,
  );
  const bedBefore = def.rule.find((c) => c.field === 'start');
  const limit = bedBefore ? rel(String(bedBefore.value)) : null;
  const { lo, hi } = axis ?? nightAxis([days], def);
  const w = 320;
  const h = compact ? 72 : 160;
  const step = w / Math.max(1, nights.length);
  const yAt = (m: number) => ((m - lo) / Math.max(1, hi - lo)) * h;
  const pickedNight = picked !== null ? nights[picked] : undefined;
  return (
    <div className="flex flex-col gap-2">
      <Readout
        text={
          pickedNight
            ? `${fmt(pickedNight.onDate)} · ${valueText(def, pickedNight.value) ?? 'kein Eintrag'}`
            : limit !== null
              ? `Ziel: ins Bett vor ${String(bedBefore?.value)}`
              : null
        }
      />
      <svg
        viewBox={`0 0 ${String(w)} ${String(h)}`}
        className="w-full"
        role="img"
        aria-label="Nächte"
      >
        {limit !== null && (
          <line
            x1={0}
            x2={w}
            y1={yAt(limit)}
            y2={yAt(limit)}
            stroke={color}
            strokeOpacity={0.5}
            strokeDasharray="4 4"
          />
        )}
        {pairs.map((p, i) => {
          const night = nights[i];
          if (!night) return null;
          return (
            <g
              key={night.onDate}
              onClick={() => {
                setPicked(i);
              }}
            >
              <rect x={i * step} y={0} width={step} height={h} fill="transparent" />
              {p && (
                <rect
                  x={i * step + step * 0.2}
                  y={yAt(p.a)}
                  width={Math.max(2, step * 0.6)}
                  height={Math.max(2, yAt(p.b) - yAt(p.a))}
                  rx={Math.min(4, step * 0.3)}
                  fill={night.state === 'done' ? color : 'var(--color-text-subtle)'}
                  opacity={picked === null || picked === i ? 1 : 0.6}
                />
              )}
            </g>
          );
        })}
      </svg>
      {!compact && (
        <div className="flex justify-between text-caption text-text-muted tabular-nums">
          <span>Balken von oben {nightClock(lo)}</span>
          <span>bis unten {nightClock(hi)}</span>
        </div>
      )}
    </div>
  );
}

/** Weekly goals: done per week against the target. */
export function HabitWeekBars({ weeks }: { weeks: HabitWeek[] }) {
  const [picked, setPicked] = useState<HabitWeek | null>(null);
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.doneDays, w.target)));
  return (
    <div className="flex flex-col gap-2">
      <Readout
        text={
          picked
            ? `Woche ab ${fmt(picked.weekStart)} · ${String(picked.doneDays)}/${String(picked.target)}${picked.state === 'paused' ? ' · Pause' : ''}`
            : null
        }
      />
      <div className="flex h-32 items-end gap-1">
        {weeks.map((week) => (
          <button
            key={week.weekStart}
            type="button"
            aria-label={`Woche ab ${fmt(week.weekStart)}: ${String(week.doneDays)} von ${String(week.target)}`}
            onClick={() => {
              setPicked(week);
            }}
            className="relative flex h-full min-w-0 flex-1 items-end"
          >
            {/* the target as a line across the bar's slot */}
            <span
              className="absolute inset-x-0 border-t border-dashed border-accent/50"
              style={{ bottom: `${String((week.target / max) * 100)}%` }}
            />
            <span
              className={cn(
                'w-full rounded-t-sm',
                week.state === 'done' ? 'bg-accent' : 'bg-text-subtle',
                picked?.weekStart === week.weekStart && 'ring-2 ring-text',
              )}
              style={{ height: `${String(Math.max(4, (week.doneDays / max) * 100))}%` }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Checklists: how often each item was ticked. */
export function HabitChecklistShare({ days, def }: { days: HabitDay[]; def: HabitDefinition }) {
  const answered = days.filter((d) => d.due && !d.paused && d.state !== 'open');
  return (
    <ul className="flex flex-col gap-2">
      {def.options.map((o) => {
        const ticked = answered.filter(
          (d) => d.value && 'checked' in d.value && d.value.checked.includes(o.key),
        ).length;
        const share = answered.length > 0 ? ticked / answered.length : 0;
        return (
          <li key={o.key} className="flex flex-col gap-1">
            <span className="flex justify-between text-subhead">
              <span className="truncate">{o.label}</span>
              <span className="text-text-muted tabular-nums">{Math.round(share * 100)} %</span>
            </span>
            <span className="h-2 overflow-hidden rounded-pill bg-surface-3">
              <span
                className="block h-full rounded-pill bg-accent"
                style={{ width: `${String(share * 100)}%` }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
