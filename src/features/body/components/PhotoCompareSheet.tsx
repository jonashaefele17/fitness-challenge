import { useRef, useState } from 'react';
import { cn } from '@/shared/lib';
import { ChevronLeftIcon, ChevronRightIcon, SegmentedControl, Sheet } from '@/shared/ui';
import { useMeasurementKinds } from '../api/useCheckins';
import { useWeightDays } from '../api/useWeight';
import { formatCm } from '../checkin';
import { formatKg, formatSignedKg, todayKey } from '../format';
import { clampPercent, defaultComparePair, defaultComparePose } from '../photoView';
import { compareCheckins, photoOfPose } from '../photos';
import type { BodyCheckin, BodyPhoto, PhotoPose } from '../types';
import { StoredImage } from './PhotoImage';

const pickDate = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' });
const date = (day: string) => new Date(`${day}T12:00:00`);

type Mode = 'side' | 'slider';
/** Arrow keys move the divider by this many percent (Page Up/Down by twice that). */
const KEY_STEP = 5;

/**
 * Two check-ins with photos compared: per pose side by side or stacked with a divider to
 * drag, then weight and measurements of both with the change. Opens with the first and the
 * latest one.
 */
export function PhotoCompareSheet({
  open,
  onOpenChange,
  checkins,
  poses,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Check-ins with photos, newest first. */
  checkins: BodyCheckin[];
  poses: readonly PhotoPose[];
}) {
  const [today] = useState(todayKey);
  const kinds = useMeasurementKinds().data ?? [];
  const days = useWeightDays(null, today).data ?? [];
  const [wasOpen, setWasOpen] = useState(false);
  const [pair, setPair] = useState<{ beforeId: string; afterId: string } | null>(null);
  const [pose, setPose] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('side');
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPair(null);
      setPose(null);
    }
  }

  const chosen = pair ?? defaultComparePair(checkins);
  const a = checkins.find((c) => c.id === chosen?.beforeId);
  const b = checkins.find((c) => c.id === chosen?.afterId);
  // Shown earlier first, whichever way round they were picked.
  const [before, after] = a && b && b.onDate < a.onDate ? [b, a] : [a, b];
  const poseKeys = poses.map((p) => p.key);
  const shownPose = pose ?? defaultComparePose(poseKeys, before, after) ?? '';
  const comparison = before && after ? compareCheckins(before, after, kinds, days) : null;
  const ids = { beforeId: before?.id ?? '', afterId: after?.id ?? '' };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Vergleichen" fullHeight>
      {before && after && comparison && (
        <div className="flex flex-col gap-4 pt-1">
          <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
            <CheckinPicker
              label="Vorher"
              value={before.id}
              checkins={checkins}
              onChange={(id) => {
                setPair({ ...ids, beforeId: id });
              }}
            />
            <CheckinPicker
              label="Nachher"
              value={after.id}
              checkins={checkins}
              onChange={(id) => {
                setPair({ ...ids, afterId: id });
              }}
            />
          </ul>
          <SegmentedControl
            label="Pose"
            value={shownPose}
            options={poses.map((p) => ({ value: p.key, label: p.label }))}
            onChange={setPose}
          />
          {mode === 'side' ? (
            <div className="grid grid-cols-2 gap-2">
              <ComparePhoto photo={photoOfPose(before, shownPose)} day={before.onDate} />
              <ComparePhoto photo={photoOfPose(after, shownPose)} day={after.onDate} />
            </div>
          ) : (
            <BeforeAfterSlider
              before={photoOfPose(before, shownPose)}
              after={photoOfPose(after, shownPose)}
              beforeDay={before.onDate}
              afterDay={after.onDate}
            />
          )}
          <SegmentedControl
            label="Ansicht"
            value={mode}
            options={[
              { value: 'side', label: 'Nebeneinander' },
              { value: 'slider', label: 'Schieberegler' },
            ]}
            onChange={setMode}
          />
          <CompareFigures
            comparison={comparison}
            beforeDay={before.onDate}
            afterDay={after.onDate}
          />
        </div>
      )}
    </Sheet>
  );
}

function CheckinPicker({
  label,
  value,
  checkins,
  onChange,
}: {
  label: string;
  value: string;
  checkins: BodyCheckin[];
  onChange: (id: string) => void;
}) {
  const current = checkins.find((c) => c.id === value);
  return (
    <li>
      {/* The phone's own picker (a wheel on the iPhone) over the whole row. */}
      <label className="relative flex min-h-tap w-full items-center gap-3 px-4 py-2 active:bg-surface-3">
        <span className="text-body">{label}</span>
        <span className="min-w-0 flex-1 truncate text-right text-subhead text-accent">
          {current ? pickDate.format(date(current.onDate)) : ''}
        </span>
        <ChevronRightIcon aria-hidden className="shrink-0 rotate-90 text-text-subtle" />
        <select
          aria-label={label}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {checkins.map((c) => (
            <option key={c.id} value={c.id}>
              {pickDate.format(date(c.onDate))}
            </option>
          ))}
        </select>
      </label>
    </li>
  );
}

function ComparePhoto({ photo, day }: { photo: BodyPhoto | undefined; day: string }) {
  return (
    <figure className="flex flex-col gap-1">
      <div className="aspect-3/4 overflow-hidden rounded-md bg-surface-2">
        {photo ? (
          <StoredImage
            path={photo.path}
            alt={shortDate.format(date(day))}
            className="size-full object-cover"
          />
        ) : (
          <NoPhoto />
        )}
      </div>
      <figcaption className="text-center text-footnote text-text-muted">
        {shortDate.format(date(day))}
      </figcaption>
    </figure>
  );
}

function NoPhoto() {
  return (
    <span className="flex size-full items-center justify-center text-footnote text-text-subtle">
      Kein Foto
    </span>
  );
}

/**
 * Before and after stacked: the earlier one on the left of the divider, the later one on
 * the right. Drag anywhere (touch or mouse), or focus the divider and use the arrow keys.
 */
function BeforeAfterSlider({
  before,
  after,
  beforeDay,
  afterDay,
}: {
  before: BodyPhoto | undefined;
  after: BodyPhoto | undefined;
  beforeDay: string;
  afterDay: string;
}) {
  const [position, setPosition] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const moveTo = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect && rect.width > 0)
      setPosition(clampPercent(((clientX - rect.left) / rect.width) * 100));
  };

  return (
    <div
      ref={ref}
      // The sheet must not take this drag; vertical scrolling stays with the page.
      data-sheet-no-drag
      className="relative aspect-3/4 w-full touch-pan-y overflow-hidden rounded-card bg-surface-2 select-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        moveTo(event.clientX);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event.clientX);
      }}
    >
      <div className="absolute inset-0">
        {after ? (
          <StoredImage path={after.path} alt="" className="size-full object-cover" />
        ) : (
          <NoPhoto />
        )}
      </div>
      <div
        className="absolute inset-0 bg-surface-2"
        style={{ clipPath: `inset(0 ${String(100 - position)}% 0 0)` }}
      >
        {before ? (
          <StoredImage path={before.path} alt="" className="size-full object-cover" />
        ) : (
          <NoPhoto />
        )}
      </div>
      <span className="pointer-events-none absolute top-2 left-2 rounded-pill glass px-3 py-1 text-caption font-semibold">
        {shortDate.format(date(beforeDay))}
      </span>
      <span className="pointer-events-none absolute top-2 right-2 rounded-pill glass px-3 py-1 text-caption font-semibold">
        {shortDate.format(date(afterDay))}
      </span>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Vorher und nachher"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${String(Math.round(position))} % vorher`}
        onKeyDown={(event) => {
          const steps: Record<string, number> = {
            ArrowLeft: -KEY_STEP,
            ArrowDown: -KEY_STEP,
            ArrowRight: KEY_STEP,
            ArrowUp: KEY_STEP,
            PageDown: -2 * KEY_STEP,
            PageUp: 2 * KEY_STEP,
          };
          const step = steps[event.key];
          if (step !== undefined) {
            event.preventDefault();
            setPosition((p) => clampPercent(p + step));
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            setPosition(event.key === 'Home' ? 0 : 100);
          }
        }}
        className="group absolute inset-y-0 flex w-tap -translate-x-1/2 cursor-ew-resize justify-center outline-none"
        style={{ left: `${String(position)}%` }}
      >
        <span aria-hidden className="h-full w-0.5 bg-text" />
        <span
          aria-hidden
          className={cn(
            'absolute top-1/2 flex size-tap -translate-y-1/2 items-center justify-center rounded-pill glass text-text',
            'group-focus-visible:ring-2 group-focus-visible:ring-accent',
          )}
        >
          <ChevronLeftIcon className="size-4" />
          <ChevronRightIcon className="size-4" />
        </span>
      </div>
    </div>
  );
}

function CompareFigures({
  comparison,
  beforeDay,
  afterDay,
}: {
  comparison: ReturnType<typeof compareCheckins>;
  beforeDay: string;
  afterDay: string;
}) {
  const { weight, measurements } = comparison;
  const rows = [
    ...(weight.before !== null || weight.after !== null
      ? [
          {
            key: 'weight',
            label: 'Gewicht',
            before: formatKg(weight.before),
            after: formatKg(weight.after),
            change: weight.change === null ? '–' : `${formatSignedKg(weight.change)} kg`,
          },
        ]
      : []),
    ...measurements.map((m) => ({
      key: m.kind.key,
      label: m.kind.label,
      before: formatCm(m.before),
      after: formatCm(m.after),
      change: m.change === null ? '–' : `${formatSignedKg(m.change)} ${m.kind.unit}`,
    })),
  ];
  if (rows.length === 0)
    return (
      <p className="text-footnote text-text-subtle">
        Zu diesen Tagen gibt es kein Gewicht und keine Maße.
      </p>
    );
  // Values without their unit (it is in the change), so they fit on one line.
  const cell = 'w-14 shrink-0 text-right tabular-nums whitespace-nowrap';
  const changeCell = 'w-20 shrink-0 text-right tabular-nums whitespace-nowrap';
  return (
    <div role="table" className="flex flex-col rounded-card bg-surface-2 px-4 py-1">
      <div role="row" className="flex items-center gap-2 py-2 text-caption text-text-muted">
        <span role="columnheader" className="min-w-0 flex-1" />
        <span role="columnheader" className={cell}>
          {shortDate.format(date(beforeDay))}
        </span>
        <span role="columnheader" className={cell}>
          {shortDate.format(date(afterDay))}
        </span>
        <span role="columnheader" className={changeCell}>
          Veränderung
        </span>
      </div>
      {rows.map((row) => (
        <div
          key={row.key}
          role="row"
          className="flex min-h-tap items-center gap-2 border-t border-border text-subhead"
        >
          <span role="rowheader" className="min-w-0 flex-1 truncate">
            {row.label}
          </span>
          <span role="cell" className={cn(cell, 'text-text-muted')}>
            {row.before}
          </span>
          <span role="cell" className={cn(cell, 'font-semibold')}>
            {row.after}
          </span>
          <span role="cell" className={changeCell}>
            {row.change}
          </span>
        </div>
      ))}
    </div>
  );
}
