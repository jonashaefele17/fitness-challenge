import { useState } from 'react';
import { showToast } from '@/shared/lib';
import { Button } from '@/shared/ui';
import {
  fitsFocus,
  historyFor,
  useExerciseOverview,
  usePrimaryMuscleIndex,
  type ExerciseHistory,
} from '../../api/useCatalog';
import {
  useExercisePopularity,
  useLinkExercise,
  useSetExerciseHidden,
  useUnlinkExercise,
} from '../../api/usePlaces';
import type { DeviceWithExercises, ExerciseSummary, TrainingFocus } from '../../types';
import { lastDoneText, longAgoText } from './historyText';
import { PickerTile, SectionTitle } from './PickerTile';

/** "Deine Übungen" covers what I did here in this window. */
const RECENT_MS = 90 * 24 * 60 * 60 * 1000;

interface Entry {
  exercise: ExerciseSummary;
  history: ExerciseHistory | undefined;
}

/**
 * One device: my recent exercises first, then ones I did long ago, then what else the type
 * offers (popular in the group first). Exercises this place lacks can be hidden here.
 */
export function DeviceDetails({
  device,
  placeId,
  focus,
  onPick,
  onAddExercise,
  onHistory,
}: {
  device: DeviceWithExercises;
  placeId: string;
  focus: TrainingFocus | null;
  onPick: (exercise: ExerciseSummary) => void;
  onAddExercise: () => void;
  onHistory: (exercise: ExerciseSummary) => void;
}) {
  const overview = useExerciseOverview().data;
  const popularity = useExercisePopularity().data;
  const muscles = usePrimaryMuscleIndex();
  const setHidden = useSetExerciseHidden(placeId);
  const unlink = useUnlinkExercise();
  const relink = useLinkExercise();
  const own = new Set(device.ownLinks);
  const [editing, setEditing] = useState(false);
  const [ignoreFocus, setIgnoreFocus] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const fitting = device.exercises.filter(
    (exercise) => ignoreFocus || fitsFocus(focus, muscles.get(exercise.id)),
  );
  const outsideFocus = device.exercises.length - fitting.length;
  const [now] = useState(() => Date.now());
  const entries: Entry[] = fitting.map((exercise) => ({
    exercise,
    history: historyFor(overview, exercise.id, device),
  }));
  const byLastDone = (a: Entry, b: Entry) =>
    (b.history?.lastDoneAt ?? '').localeCompare(a.history?.lastDoneAt ?? '');
  const recent = entries
    .filter((e) => e.history && now - new Date(e.history.lastDoneAt).getTime() <= RECENT_MS)
    .sort(byLastDone);
  const earlier = entries
    .filter((e) => e.history && now - new Date(e.history.lastDoneAt).getTime() > RECENT_MS)
    .sort(byLastDone);
  const more = entries
    .filter((e) => !e.history)
    .sort(
      (a, b) =>
        (popularity?.get(b.exercise.id) ?? 0) - (popularity?.get(a.exercise.id) ?? 0) ||
        a.exercise.name.localeCompare(b.exercise.name, 'de'),
    );

  function hide(exercise: ExerciseSummary) {
    setHidden.mutate({ deviceId: device.id, exercise, hidden: true });
    showToast(`${exercise.name} ist hier ausgeblendet.`, {
      label: 'Rückgängig',
      onAction: () => {
        setHidden.mutate({ deviceId: device.id, exercise, hidden: false });
      },
    });
  }

  /** My own link (e.g. a mis-tap) goes away entirely; others' links are only hidden here. */
  function remove(exercise: ExerciseSummary) {
    unlink.mutate({ typeId: device.typeId, exerciseId: exercise.id });
    showToast(`${exercise.name} ist nicht mehr bei ${device.name}.`, {
      label: 'Rückgängig',
      onAction: () => {
        relink.mutate({ device, exerciseId: exercise.id });
      },
    });
  }

  function section(title: string, list: Entry[], subtitle: (entry: Entry) => string) {
    if (list.length === 0) return null;
    return (
      <>
        <SectionTitle>{title}</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {list.map((entry) => (
            <PickerTile
              key={entry.exercise.id}
              title={entry.exercise.name}
              subtitle={
                editing
                  ? own.has(entry.exercise.id)
                    ? 'Tippen zum Entfernen'
                    : 'Tippen zum Ausblenden'
                  : subtitle(entry)
              }
              trend={editing ? undefined : entry.history?.trend}
              muted={editing}
              onInfo={
                !editing && entry.history
                  ? () => {
                      onHistory(entry.exercise);
                    }
                  : undefined
              }
              onClick={() => {
                if (editing && own.has(entry.exercise.id)) remove(entry.exercise);
                else if (editing) hide(entry.exercise);
                else onPick(entry.exercise);
              }}
            />
          ))}
        </div>
      </>
    );
  }

  const muscleText = (exercise: ExerciseSummary) =>
    muscles
      .get(exercise.id)
      ?.map((m) => m.label)
      .join(' · ') ?? 'Muskelgruppe fehlt';

  return (
    <div className="flex flex-col gap-3">
      <div
        aria-hidden
        className="flex aspect-[5/2] items-center justify-center rounded-card image-backdrop text-large-title font-bold text-accent/70"
      >
        {device.name.charAt(0).toUpperCase()}
      </div>

      {device.exercises.length === 0 && (
        <p className="text-subhead text-text-muted">
          Diesem Gerät ist noch keine Übung zugeordnet.
        </p>
      )}
      {editing && (
        <p className="text-subhead text-text-muted">
          Tipp auf Übungen, die es hier nicht gibt: Sie verschwinden nur an diesem Gerät. Was du
          selbst zugeordnet hast, wird ganz entfernt.
        </p>
      )}

      {section('Deine Übungen', recent, (e) =>
        e.history ? lastDoneText(e.history, e.exercise) : '',
      )}
      {section('Früher gemacht', earlier, (e) =>
        e.history ? longAgoText(e.history.lastDoneAt, now) : '',
      )}
      {section('Weitere Übungen', more, (e) => {
        const uses = popularity?.get(e.exercise.id) ?? 0;
        return uses > 0 ? `${String(uses)}× in der Gruppe` : muscleText(e.exercise);
      })}

      {focus && outsideFocus > 0 && (
        <button
          type="button"
          onClick={() => {
            setIgnoreFocus(true);
          }}
          className="min-h-tap text-left text-subhead text-accent"
        >
          {outsideFocus === 1
            ? `1 weitere Übung passt nicht zu ${focus.name} – anzeigen`
            : `${String(outsideFocus)} weitere passen nicht zu ${focus.name} – anzeigen`}
        </button>
      )}

      {device.hiddenExercises.length > 0 && (
        <div className="flex flex-col">
          <button
            type="button"
            aria-expanded={showHidden}
            onClick={() => {
              setShowHidden((open) => !open);
            }}
            className="min-h-tap text-left text-subhead text-text-muted"
          >
            Hier nicht verfügbar ({device.hiddenExercises.length}) {showHidden ? '▴' : '▾'}
          </button>
          {showHidden && (
            <ul className="-mx-gutter flex flex-col">
              {device.hiddenExercises.map((exercise) => (
                <li
                  key={exercise.id}
                  className="flex min-h-tap items-center justify-between gap-3 px-gutter"
                >
                  <span className="text-body text-text-muted">{exercise.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setHidden.mutate({ deviceId: device.id, exercise, hidden: false });
                    }}
                    className="min-h-tap px-2 text-subhead font-semibold text-accent"
                  >
                    Wieder anzeigen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button variant="secondary" onClick={onAddExercise}>
        + Übung zuordnen
      </Button>
      {device.exercises.length > 0 && (
        <Button
          variant="ghost"
          onClick={() => {
            setEditing((on) => !on);
          }}
        >
          {editing ? 'Fertig' : 'Übungen bearbeiten'}
        </Button>
      )}
    </div>
  );
}
