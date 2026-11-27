import { useState } from 'react';
import { DateRow, goalTodayKey, matchingPeriodChoice, periodEnd } from '@/features/goals';
import { useActiveGroup, useGroupMembers } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { showToast } from '@/shared/lib';
import { Button, Chip, FieldGroup, Sheet, Switch, TextField } from '@/shared/ui';
import { useCancelSeason, useCreateSeason, useUpdateSeason } from '../api/useSeasons';
import { seasonErrorText } from '../format';
import { seasonUpdateOf } from '../season';
import {
  CHECKIN_CHOICES,
  newSeasonDraft,
  SEASON_LENGTHS,
  seasonDraftOf,
  seasonStarted,
  validateSeasonDraft,
  type SeasonDraft,
} from '../setup';
import type { Season } from '../types';

/**
 * Group admins: a new season, or the current one changed (before the start everything,
 * afterwards only the name), and "Saison absagen" with a real question. Saves at once;
 * a change can be taken back with "Rückgängig".
 */
export function SeasonEditSheet({
  season,
  open,
  onOpenChange,
  onCreated,
}: {
  /** null: a new season. */
  season: Season | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A new season was saved (shown at once, optimistic): its id. */
  onCreated?: (seasonId: string) => void;
}) {
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  // The mutations live here, outside the form, so "Rückgängig" still works after closing.
  const create = useCreateSeason();
  const update = useUpdateSeason();
  const cancel = useCancelSeason();
  const [today] = useState(goalTodayKey);
  const [draft, setDraft] = useState<SeasonDraft>(() => newSeasonDraft(today, []));
  const [confirming, setConfirming] = useState(false);
  const [edited, setEdited] = useState(false);

  // A fresh form each time it opens (state adjusted while rendering).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(
        season
          ? seasonDraftOf(season)
          : newSeasonDraft(
              today,
              members.map((m) => m.userId),
            ),
      );
      setConfirming(false);
      setEdited(false);
    }
  }
  // Members may arrive after the sheet opened: everyone is preselected.
  if (open && !season && draft.participants.length === 0 && members.length > 0 && !edited) {
    setDraft({ ...draft, participants: members.map((m) => m.userId) });
  }

  const started = season !== null && seasonStarted(season);
  const error = validateSeasonDraft(draft, today, { started, creating: season === null });
  const set = (patch: Partial<SeasonDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setEdited(true);
  };
  const length = matchingPeriodChoice(draft.startsOn, draft.endsOn);

  function refused(error: unknown, fallback: string) {
    showToast(seasonErrorText(error) ?? fallback);
  }

  function save() {
    onOpenChange(false);
    if (!season) {
      const id = crypto.randomUUID();
      create.mutate(
        {
          id,
          name: draft.name.trim(),
          startsOn: draft.startsOn,
          endsOn: draft.endsOn,
          setupOpensOn: draft.setupOpensOn,
          participants: draft.participants,
          weighWeekly: draft.weighWeekly,
          checkinEveryWeeks: draft.checkinEveryWeeks,
        },
        {
          onError: (e) => {
            refused(e, 'Saison konnte nicht angelegt werden.');
          },
        },
      );
      showToast('Saison angelegt');
      onCreated?.(id);
      return;
    }
    const previous = seasonUpdateOf(season);
    update.mutate(
      {
        ...previous,
        name: draft.name.trim(),
        ...(started
          ? {}
          : {
              startsOn: draft.startsOn,
              endsOn: draft.endsOn,
              setupOpensOn: draft.setupOpensOn,
              weighWeekly: draft.weighWeekly,
              checkinEveryWeeks: draft.checkinEveryWeeks,
            }),
      },
      {
        onError: (e) => {
          refused(e, 'Änderung konnte nicht gespeichert werden.');
        },
      },
    );
    showToast('Saison geändert', {
      label: 'Rückgängig',
      onAction: () => {
        update.mutate(previous, {
          onError: (e) => {
            refused(e, 'Konnte nicht rückgängig gemacht werden.');
          },
        });
      },
    });
  }

  function cancelSeason() {
    if (!season) return;
    setConfirming(false);
    onOpenChange(false);
    cancel.mutate(season.id, {
      onError: (e) => {
        refused(e, 'Saison konnte nicht abgesagt werden.');
      },
    });
    showToast('Saison abgesagt');
  }

  return (
    <>
      <Sheet
        fullHeight
        open={open && !confirming}
        onOpenChange={onOpenChange}
        title={season ? 'Saison bearbeiten' : 'Neue Saison'}
        className="min-h-sheet-min"
        footer={
          <Button size="lg" fullWidth missing={error} onClick={save}>
            {season ? 'Speichern' : 'Saison anlegen'}
          </Button>
        }
      >
        <div className="flex flex-col gap-6 pt-1">
          <TextField
            label="Name"
            placeholder="z. B. Winterform"
            value={draft.name}
            maxLength={60}
            onChange={(event) => {
              set({ name: event.target.value });
            }}
          />

          {started ? (
            <p className="text-footnote text-text-muted">
              Die Saison läuft – Zeitraum, Teilnehmer-Start und Regeln stehen fest. Nur der Name
              lässt sich noch ändern.
            </p>
          ) : (
            <>
              <FieldGroup label="Zeitraum">
                <div className="flex flex-wrap gap-2">
                  {SEASON_LENGTHS.map((c) => (
                    <Chip
                      key={c.value}
                      selected={length === c.value}
                      onClick={() => {
                        set({ endsOn: periodEnd(draft.startsOn, c.value) });
                      }}
                    >
                      {c.label}
                    </Chip>
                  ))}
                </div>
                <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
                  <DateRow
                    label="Start"
                    day={draft.startsOn}
                    today={today}
                    min={today}
                    onChange={(day) => {
                      set({
                        startsOn: day,
                        endsOn: length ? periodEnd(day, length) : draft.endsOn,
                        setupOpensOn: draft.setupOpensOn > day ? day : draft.setupOpensOn,
                      });
                    }}
                  />
                  <DateRow
                    label="Ende"
                    day={draft.endsOn}
                    today={today}
                    min={draft.startsOn}
                    onChange={(day) => {
                      set({ endsOn: day });
                    }}
                  />
                  <DateRow
                    label="Einrichten ab"
                    day={draft.setupOpensOn}
                    today={today}
                    min={today}
                    onChange={(day) => {
                      set({ setupOpensOn: day });
                    }}
                  />
                </ul>
                <p className="text-footnote text-text-muted">
                  Ab „Einrichten“ setzen alle ihre Ziele. Am Start werden sie festgeschrieben – wer
                  bis dahin nicht fertig ist, richtet danach ein, fest ab „Bereit“.
                </p>
              </FieldGroup>

              <FieldGroup label="Regeln">
                <div className="flex flex-col divide-y divide-border rounded-card bg-surface-2 px-4">
                  <Switch
                    label="Jede Woche wiegen"
                    checked={draft.weighWeekly}
                    onCheckedChange={(weighWeekly) => {
                      set({ weighWeekly });
                    }}
                  />
                  <div className="flex flex-col gap-2 py-3">
                    <span className="text-body">Zwischenstand</span>
                    <div className="flex flex-wrap gap-2">
                      {CHECKIN_CHOICES.map((weeks) => (
                        <Chip
                          key={weeks ?? 'off'}
                          selected={draft.checkinEveryWeeks === weeks}
                          onClick={() => {
                            set({ checkinEveryWeeks: weeks });
                          }}
                        >
                          {weeks === null ? 'Aus' : `alle ${String(weeks)} Wo.`}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div className="flex min-h-tap items-center justify-between gap-3 py-2">
                    <span className="text-body">Pflicht-Ziel</span>
                    <span className="text-subhead text-text-muted">Trainings pro Woche</span>
                  </div>
                </div>
                <p className="text-footnote text-text-muted">
                  Wiegetag und Uhrzeiten wählt jede Person beim Einrichten selbst.
                </p>
              </FieldGroup>

              {season === null && (
                <FieldGroup label="Teilnehmer">
                  <div className="flex flex-col divide-y divide-border rounded-card bg-surface-2 px-4">
                    {members.map((member) => (
                      <div key={member.userId} className="flex items-center gap-3">
                        <Avatar profile={member} size="sm" />
                        <div className="min-w-0 flex-1">
                          <Switch
                            label={member.displayName}
                            checked={draft.participants.includes(member.userId)}
                            onCheckedChange={(on) => {
                              set({
                                participants: on
                                  ? [...draft.participants, member.userId]
                                  : draft.participants.filter((id) => id !== member.userId),
                              });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </FieldGroup>
              )}
            </>
          )}

          {season && season.phase !== 'cancelled' && season.phase !== 'ended' && (
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                setConfirming(true);
              }}
            >
              Saison absagen
            </Button>
          )}
        </div>
      </Sheet>

      <Sheet
        open={open && confirming}
        onOpenChange={(next) => {
          if (!next) setConfirming(false);
        }}
        title="Saison absagen?"
        description="Die Ziele aller Teilnehmer bleiben als normale Ziele erhalten, im Feed steht die Saison dann als abgesagt. Das lässt sich nicht rückgängig machen."
      >
        <div className="flex flex-col gap-2">
          <Button variant="danger" fullWidth onClick={cancelSeason}>
            Absagen
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              setConfirming(false);
            }}
          >
            Nicht absagen
          </Button>
        </div>
      </Sheet>
    </>
  );
}
