import { useEffect, useState } from 'react';
import { ChevronRightIcon } from '@/shared/ui';
import { useCheckins } from '../api/useCheckins';
import { useBodySettings, useScales, useWeighIns } from '../api/useWeight';
import { checkinOn, checkinRhythmSummary } from '../checkin';
import { reminderSummary, todayKey, WEIGHT_SHARE_LABELS } from '../format';
import type { BodyCheckin, WeighIn } from '../types';
import { CheckinFlow } from './CheckinFlow';
import { CheckinSection } from './CheckinSection';
import { CheckinSettingsSheet } from './CheckinSettingsSheet';
import { ReminderSheet } from './ReminderSheet';
import { ScalesSheet } from './ScalesSheet';
import { SharingSheet } from './SharingSheet';
import { WeighInSheet } from './WeighInSheet';
import { WeightSection } from './WeightSection';

/**
 * Ich → Körper: the weight (current value, change, chart, entries), the Zwischenstand
 * (measurements every few weeks), and the settings rows: scales, reminder, sharing, rhythm.
 */
export function BodyOverview({
  openNew = false,
  openSharing = false,
  openCheckin = false,
  onOpened,
}: {
  /** Open the weigh-in right away (from the reminder push). */
  openNew?: boolean;
  /** Open "Sichtbarkeit" right away (from the group's weight comparison). */
  openSharing?: boolean;
  /** Open the Zwischenstand right away (from its reminder push). */
  openCheckin?: boolean;
  onOpened?: () => void;
} = {}) {
  const [today] = useState(todayKey);
  // Kept while the sheet closes, so its title does not change on the way out.
  const [shownEntry, setShownEntry] = useState<WeighIn | null>(null);
  const [editing, setEditing] = useState(false);
  const [shownCheckin, setShownCheckin] = useState<BodyCheckin | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [scalesOpen, setScalesOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [rhythmOpen, setRhythmOpen] = useState(false);
  const entries = useWeighIns(null, today);
  const scales = useScales().data ?? [];
  const settings = useBodySettings().data;
  const checkins = useCheckins().data;

  const weigh = (entry: WeighIn | null) => {
    setShownEntry(entry);
    setEditing(true);
  };
  // A new Zwischenstand is for today; if today already has one, that one opens to change.
  const startCheckin = (checkin: BodyCheckin | null) => {
    const todays = checkins ? checkinOn(checkins, today) : undefined;
    setShownCheckin(checkin ?? (todays && !todays.skipped ? todays : null));
    setCheckinOpen(true);
  };

  // From a push or another tab: open the sheet when the link arrives (once, not again on
  // closing while the link is still there), then let the caller drop the link (it
  // navigates, so in an effect).
  const link = openNew ? 'weigh' : openSharing ? 'sharing' : openCheckin ? 'checkin' : null;
  const [linked, setLinked] = useState<typeof link>(null);
  if (link !== linked) {
    setLinked(link);
    if (link === 'weigh') weigh(null);
    if (link === 'sharing') setSharingOpen(true);
    if (link === 'checkin') startCheckin(null);
  }
  useEffect(() => {
    if (link) onOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
  }, [link]);

  const sheets = (
    <>
      <WeighInSheet open={editing} onOpenChange={setEditing} entry={shownEntry} />
      <CheckinFlow open={checkinOpen} onOpenChange={setCheckinOpen} checkin={shownCheckin} />
      <ScalesSheet open={scalesOpen} onOpenChange={setScalesOpen} />
      <ReminderSheet open={reminderOpen} onOpenChange={setReminderOpen} />
      <SharingSheet open={sharingOpen} onOpenChange={setSharingOpen} />
      <CheckinSettingsSheet open={rhythmOpen} onOpenChange={setRhythmOpen} />
    </>
  );

  if (entries.isPending) return sheets;

  return (
    <div className="flex flex-col gap-4">
      <WeightSection entries={entries.data ?? []} scales={scales} today={today} onWeigh={weigh} />
      <CheckinSection today={today} onOpen={startCheckin} />
      <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        <SettingsRow
          label="Waagen"
          value={scales
            .filter((s) => !s.archived)
            .map((s) => s.name)
            .join(', ')}
          onOpen={() => {
            setScalesOpen(true);
          }}
        />
        <SettingsRow
          label="Erinnerung"
          value={reminderSummary(settings)}
          onOpen={() => {
            setReminderOpen(true);
          }}
        />
        <SettingsRow
          label="Sichtbarkeit"
          value={settings ? WEIGHT_SHARE_LABELS[settings.weightShare] : ''}
          onOpen={() => {
            setSharingOpen(true);
          }}
        />
        <SettingsRow
          label="Zwischenstand"
          value={settings ? checkinRhythmSummary(settings) : ''}
          onOpen={() => {
            setRhythmOpen(true);
          }}
        />
      </ul>
      {sheets}
    </div>
  );
}

function SettingsRow({
  label,
  value,
  onOpen,
}: {
  label: string;
  value: string;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-3"
      >
        <span className="text-body">{label}</span>
        <span className="min-w-0 flex-1 truncate text-right text-subhead text-text-muted">
          {value}
        </span>
        <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
      </button>
    </li>
  );
}
