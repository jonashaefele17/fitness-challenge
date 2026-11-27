import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, ChevronRightIcon, Sheet } from '@/shared/ui';
import {
  useCheckins,
  useCheckinStatus,
  useMeasurementKinds,
  useMeasurementStats,
} from '../api/useCheckins';
import { useBodySettings } from '../api/useWeight';
import { checkinDueText, formatCm, formatSignedCm } from '../checkin';
import { kindHistory, measurementRows } from '../checkinFlow';
import { checkinsWithPhotos } from '../photos';
import type { BodyCheckin, MeasurementKind, MeasurementStat } from '../types';
import { MeasurementSparkline } from './MeasurementChart';
import { MeasurementHistorySheet } from './MeasurementHistorySheet';
import { PhotosSheet } from './PhotosSheet';

const listDate = new Intl.DateTimeFormat('de', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const shortDate = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' });
const date = (day: string) => new Date(`${day}T12:00:00`);

/**
 * Ich → Körper → Zwischenstand: one card with when the next one is due, the action, per
 * measurement the latest value with its changes and a small curve (tap: its history), and
 * a row that opens all check-ins.
 */
export function CheckinSection({
  today,
  onOpen,
}: {
  today: string;
  /** Open the flow: a check-in to change, or null for a new one. */
  onOpen: (checkin: BodyCheckin | null) => void;
}) {
  const kinds = useMeasurementKinds();
  const checkins = useCheckins();
  const stats = useMeasurementStats();
  const status = useCheckinStatus(today).data;
  const settings = useBodySettings().data;
  // Kept while the sheet closes, so its title does not change on the way out.
  const [shownKind, setShownKind] = useState<MeasurementKind | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);

  if (!kinds.data || !checkins.data || !stats.data) return null;
  const list = checkins.data;
  const withPhotos = checkinsWithPhotos(list);
  const rows = measurementRows(kinds.data, settings?.hiddenMeasurementKinds ?? [], stats.data);
  const dueText = status ? checkinDueText(status) : null;
  const due = status?.due ?? false;

  return (
    <>
      <section
        className={cn(
          'flex flex-col gap-3 rounded-card bg-surface-2 pt-4',
          list.length === 0 && 'pb-4',
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-body font-semibold">Zwischenstand</h2>
            {dueText && (
              <span className={cn('text-footnote', due ? 'text-accent' : 'text-text-muted')}>
                {dueText}
              </span>
            )}
          </div>
          <Button
            variant="tinted"
            onClick={() => {
              onOpen(null);
            }}
          >
            Starten
          </Button>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 text-subhead text-text-muted">
            Alle paar Wochen Maße nehmen, damit du Veränderungen siehst, die die Waage nicht zeigt.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-t border-border">
            {rows.map(({ kind, stat }) => (
              <li key={kind.key}>
                <KindRow
                  kind={kind}
                  stat={stat}
                  history={kindHistory(list, kind.key)}
                  onOpen={() => {
                    setShownKind(kind);
                    setHistoryOpen(true);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
        {list.length > 0 && (
          <div
            className={cn(
              'flex flex-col divide-y divide-border border-t border-border',
              // Below the measurement rows their gap is not wanted; alone it needs the line.
              rows.length > 0 && '-mt-3',
            )}
          >
            {withPhotos.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPhotosOpen(true);
                }}
                className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-3"
              >
                <span className="text-body">Fotos</span>
                <span className="min-w-0 flex-1 truncate text-right text-subhead text-text-muted tabular-nums">
                  {withPhotos.length === 1
                    ? '1 Zwischenstand'
                    : `${String(withPhotos.length)} Zwischenstände`}
                </span>
                <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setListOpen(true);
              }}
              className="flex min-h-tap w-full items-center gap-3 rounded-b-card px-4 py-2 text-left active:bg-surface-3"
            >
              <span className="text-body">Alle Zwischenstände</span>
              <span className="min-w-0 flex-1 truncate text-right text-subhead text-text-muted tabular-nums">
                {list.length}
              </span>
              <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
            </button>
          </div>
        )}
      </section>

      <MeasurementHistorySheet kind={shownKind} open={historyOpen} onOpenChange={setHistoryOpen} />
      <PhotosSheet open={photosOpen} onOpenChange={setPhotosOpen} />
      <Sheet open={listOpen} onOpenChange={setListOpen} title="Alle Zwischenstände">
        <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          {list.map((checkin) => (
            <li key={checkin.id}>
              <button
                type="button"
                onClick={() => {
                  setListOpen(false);
                  onOpen(checkin);
                }}
                className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-3"
              >
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-subhead',
                    checkin.skipped && 'text-text-muted',
                  )}
                >
                  {listDate.format(date(checkin.onDate))}
                </span>
                <span className="text-subhead text-text-muted">
                  {checkin.skipped ? 'ausgelassen' : measuresText(checkin)}
                </span>
                <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

function measuresText(checkin: BodyCheckin): string {
  const count = Object.keys(checkin.values).length;
  const photos = checkin.photos.length;
  const parts = [
    count > 0 || photos === 0 ? (count === 1 ? '1 Maß' : `${String(count)} Maße`) : null,
    photos > 0 ? (photos === 1 ? '1 Foto' : `${String(photos)} Fotos`) : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

function KindRow({
  kind,
  stat,
  history,
  onOpen,
}: {
  kind: MeasurementKind;
  stat: MeasurementStat;
  history: ReturnType<typeof kindHistory>;
  onOpen: () => void;
}) {
  const changes =
    stat.changeSincePrevious === null
      ? `Erster Wert · ${shortDate.format(date(stat.latestOn))}`
      : `${formatSignedCm(stat.changeSincePrevious)} seit letztem · ${formatSignedCm(
          stat.changeSinceFirst,
        )} seit Start`;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-3"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-body">{kind.label}</span>
          <MeasurementSparkline points={history} />
          {/* One width for all rows, so the curves line up. */}
          <span className="min-w-20 text-right text-body font-semibold tabular-nums">
            {formatCm(stat.latestValue)} {kind.unit}
          </span>
        </span>
        <span className="truncate text-footnote text-text-muted tabular-nums">{changes}</span>
      </span>
      <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
    </button>
  );
}
