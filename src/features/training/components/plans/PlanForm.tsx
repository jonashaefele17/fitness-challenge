import { useContext, useState } from 'react';
import { cn } from '@/shared/lib';
import {
  Button,
  ChevronRightIcon,
  FieldGroup,
  SegmentedControl,
  Sheet,
  Switch,
  TextField,
} from '@/shared/ui';
import { useTrainingFocuses, useTrainingTypes } from '../../api/useCatalog';
import { useSavePlan } from '../../api/usePlans';
import type { PlanDay, PlanDraft } from '../../types';
import { TrainingTypeIcon } from '../TrainingTypeIcon';
import { isoWeekday, WEEKDAY_NAMES, WEEKDAY_SHORT } from './planDraft';
import { PlanTargetPicker } from './PlanTargetPicker';
import { PlanSocialContext } from './social';

const chip =
  'flex min-h-tap shrink-0 items-center gap-2 rounded-pill border px-4 text-subhead font-semibold';
const on = 'border-accent bg-accent text-on-accent';
const off = 'border-border bg-surface-2 active:bg-surface-3';

/**
 * Plan a training or an event: type, focus and templates (or a name), day, time, note, and
 * optionally weekly on chosen weekdays, each weekday with its own focus and templates if
 * wanted (Mo = Push, Do = Pull). A series is edited as a whole; single dates are changed
 * from their detail.
 */
export function PlanForm({ initial, onSaved }: { initial: PlanDraft; onSaved: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [editDay, setEditDay] = useState<number | null>(null);
  const types = useTrainingTypes().data ?? [];
  const focuses = useTrainingFocuses().data ?? [];
  const save = useSavePlan();
  // Whom to invite (a new plan; later changes happen in the detail).
  const [invitees, setInvitees] = useState<string[]>([]);
  const social = useContext(PlanSocialContext);
  const invite = social.useInvite();
  const InviteField = draft.id ? null : social.InviteField;
  const repeats = draft.repeatWeekdays.length > 0;
  const training = draft.kind === 'training';
  const missing =
    training && !draft.trainingTypeId
      ? 'Wähl eine Trainingsart.'
      : !training && !draft.title.trim()
        ? 'Gib dem Event einen Namen.'
        : null;

  function set(changes: Partial<PlanDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function dayOf(weekday: number): PlanDay | undefined {
    return draft.days.find((day) => day.weekday === weekday);
  }

  function setDay(weekday: number, day: Omit<PlanDay, 'weekday'> | null) {
    setDraft((current) => ({
      ...current,
      days: [
        ...current.days.filter((d) => d.weekday !== weekday),
        ...(day ? [{ weekday, ...day }] : []),
      ],
    }));
  }

  /** "Push · 2 Vorlagen" / "wie oben" */
  function daySummary(weekday: number): string {
    const day = dayOf(weekday);
    if (!day) return 'wie oben';
    const focus = focuses.find((f) => f.id === day.focusId)?.name;
    const count = day.templateIds.length;
    return (
      [focus, count === 1 ? '1 Vorlage' : count > 1 ? `${String(count)} Vorlagen` : null]
        .filter(Boolean)
        .join(' · ') || 'ohne Fokus und Vorlage'
    );
  }

  const editing = editDay !== null ? (dayOf(editDay) ?? null) : null;

  return (
    <form
      className="flex flex-col gap-6 pt-1"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(draft, {
          onSuccess: (planId) => {
            if (invitees.length > 0) void invite(planId, invitees);
            onSaved();
          },
        });
      }}
    >
      <SegmentedControl
        label="Art des Termins"
        value={draft.kind}
        onChange={(kind) => {
          set({ kind });
        }}
        options={[
          { value: 'training', label: 'Training' },
          { value: 'event', label: 'Event' },
        ]}
      />

      {training ? (
        <>
          <FieldGroup label="Trainingsart">
            <div className="-mx-gutter no-scrollbar flex gap-2 overflow-x-auto px-gutter">
              {types.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  aria-pressed={draft.trainingTypeId === type.id}
                  onClick={() => {
                    set({ trainingTypeId: type.id, focusId: null, templateIds: [], days: [] });
                  }}
                  className={cn(chip, draft.trainingTypeId === type.id ? on : off)}
                >
                  <TrainingTypeIcon icon={type.icon} className="size-4" />
                  {type.name}
                </button>
              ))}
            </div>
          </FieldGroup>
          <PlanTargetPicker
            trainingTypeId={draft.trainingTypeId}
            value={{ focusId: draft.focusId, templateIds: draft.templateIds }}
            onChange={(target) => {
              set(target);
            }}
          />
        </>
      ) : (
        <TextField
          label="Name"
          placeholder="z. B. Stadtlauf, Grillen"
          value={draft.title}
          maxLength={60}
          onChange={(event) => {
            set({ title: event.target.value });
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Tag"
          type="date"
          className="h-tap appearance-none"
          value={draft.startsOn}
          onChange={(event) => {
            set({ startsOn: event.target.value });
          }}
        />
        <TextField
          label="Uhrzeit (optional)"
          type="time"
          className="h-tap appearance-none"
          value={draft.startTime}
          onChange={(event) => {
            set({ startTime: event.target.value });
          }}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Switch
          label="Wöchentlich wiederholen"
          checked={repeats}
          onCheckedChange={(repeat) => {
            set({
              repeatWeekdays: repeat ? [isoWeekday(draft.startsOn)] : [],
              repeatUntil: '',
              days: [],
            });
          }}
        />
        {repeats && (
          <>
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
                const active = draft.repeatWeekdays.includes(weekday);
                return (
                  <button
                    key={weekday}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      const next = active
                        ? draft.repeatWeekdays.filter((d) => d !== weekday)
                        : [...draft.repeatWeekdays, weekday].sort();
                      // At least one day stays chosen while repeating.
                      if (next.length > 0) set({ repeatWeekdays: next });
                    }}
                    className={cn(
                      'flex min-h-tap items-center justify-center rounded-pill border text-footnote font-semibold',
                      active ? on : off,
                    )}
                  >
                    {WEEKDAY_SHORT[weekday]}
                  </button>
                );
              })}
            </div>

            {training && draft.repeatWeekdays.length > 1 && (
              <FieldGroup label="Pro Wochentag (optional)">
                <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
                  {draft.repeatWeekdays.map((weekday) => (
                    <li key={weekday}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditDay(weekday);
                        }}
                        className="flex min-h-tap w-full items-center justify-between gap-3 px-4 py-2.5 text-left active:bg-surface-3"
                      >
                        <span className="text-subhead font-semibold">{WEEKDAY_NAMES[weekday]}</span>
                        <span className="flex min-w-0 items-center gap-2 text-footnote text-text-muted">
                          <span className="truncate">{daySummary(weekday)}</span>
                          <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </FieldGroup>
            )}

            <TextField
              label="Bis (optional)"
              type="date"
              className="h-tap appearance-none"
              min={draft.startsOn}
              value={draft.repeatUntil}
              onChange={(event) => {
                set({ repeatUntil: event.target.value });
              }}
            />
          </>
        )}
      </div>

      {InviteField && <InviteField value={invitees} onChange={setInvitees} />}

      <TextField
        label="Notiz (optional)"
        value={draft.note}
        maxLength={500}
        onChange={(event) => {
          set({ note: event.target.value });
        }}
      />

      {save.isError && (
        <p role="alert" className="text-footnote text-danger">
          Speichern hat nicht geklappt.
        </p>
      )}
      <Button type="submit" size="lg" missing={missing} loading={save.isPending}>
        {draft.id ? 'Speichern' : 'Planen'}
      </Button>

      <Sheet
        fullHeight
        open={editDay !== null}
        onOpenChange={(open) => {
          if (!open) setEditDay(null);
        }}
        title={editDay !== null ? (WEEKDAY_NAMES[editDay] ?? 'Tag') : 'Tag'}
      >
        {editDay !== null && (
          <div className="flex flex-col gap-6 pt-1">
            <PlanTargetPicker
              trainingTypeId={draft.trainingTypeId}
              value={editing ?? { focusId: draft.focusId, templateIds: draft.templateIds }}
              onChange={(target) => {
                setDay(editDay, target);
              }}
            />
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setEditDay(null);
                }}
              >
                Fertig
              </Button>
              {editing && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDay(editDay, null);
                    setEditDay(null);
                  }}
                >
                  Wie oben
                </Button>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </form>
  );
}
