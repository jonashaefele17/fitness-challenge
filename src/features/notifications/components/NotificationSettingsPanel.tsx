import { Card, SegmentedControl, Switch } from '@/shared/ui';
import {
  useNotificationSettings,
  useSaveNotificationPrefs,
  useSetCategoryEnabled,
} from '../api/useNotificationSettings';
import { isCategoryEnabled, presets } from '../settings';
import { PushSection } from './PushSection';
import type { NotificationPrefs } from '../types';

/** "Ich → Benachrichtigungen": preset, categories, bundling and quiet hours. */
export function NotificationSettingsPanel() {
  const settings = useNotificationSettings();
  const save = useSaveNotificationPrefs();
  const setCategory = useSetCategoryEnabled();

  if (settings.isPending) {
    return (
      <Card className="text-subhead text-text-subtle">Benachrichtigungen werden geladen …</Card>
    );
  }
  if (settings.isError) {
    return (
      <Card className="text-subhead text-text-muted">
        Einstellungen konnten nicht geladen werden.
      </Card>
    );
  }

  const { categories, prefs, overrides } = settings.data;
  const update = (changes: Partial<NotificationPrefs>, resetOverrides = false) => {
    save.mutate({ prefs: { ...prefs, ...changes }, resetOverrides });
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="notification-settings-title">
      <h2 id="notification-settings-title" className="text-title-3 font-semibold">
        Benachrichtigungen
      </h2>
      <PushSection />
      <Card className="flex flex-col gap-3">
        <SegmentedControl
          label="Voreinstellung"
          value={prefs.preset}
          options={presets}
          onChange={(preset) => {
            update({ preset }, true);
          }}
        />
        <div className="flex flex-col divide-y divide-border">
          {categories.map((category) => (
            <Switch
              key={category.key}
              label={category.label}
              description={category.description}
              checked={isCategoryEnabled(category, prefs.preset, overrides)}
              onCheckedChange={(enabled) => {
                setCategory.mutate({ category: category.key, enabled });
              }}
            />
          ))}
        </div>
      </Card>
      <Card className="flex flex-col divide-y divide-border">
        <Switch
          label="Bündeln"
          description="Mehrere Mitteilungen innerhalb von 5 Minuten als eine."
          checked={prefs.bundle}
          onCheckedChange={(bundle) => {
            update({ bundle });
          }}
        />
        <Switch
          label="Ruhezeit"
          description={`Keine Push-Mitteilungen von ${prefs.quietStart} bis ${prefs.quietEnd} Uhr.`}
          checked={prefs.quietHoursEnabled}
          onCheckedChange={(quietHoursEnabled) => {
            update({ quietHoursEnabled });
          }}
        />
        {prefs.quietHoursEnabled && (
          <div className="flex gap-4 py-3">
            <TimeInput
              label="Von"
              value={prefs.quietStart}
              onChange={(quietStart) => {
                update({ quietStart });
              }}
            />
            <TimeInput
              label="Bis"
              value={prefs.quietEnd}
              onChange={(quietEnd) => {
                update({ quietEnd });
              }}
            />
          </div>
        )}
      </Card>
    </section>
  );
}

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1 text-footnote text-text-muted">
      {label}
      <input
        type="time"
        value={value}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
        className="min-h-tap rounded-md border border-border bg-surface-2 px-3 text-body text-text focus:border-accent focus:outline-none"
      />
    </label>
  );
}
