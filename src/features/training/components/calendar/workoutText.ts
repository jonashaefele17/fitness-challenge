import type { CalendarWorkout } from '../../types';

const km = new Intl.NumberFormat('de', { maximumFractionDigits: 1 });

/** "58 Min" / "1 h 12 Min" */
export function formatMinutes(seconds: number | null): string | null {
  if (seconds === null) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${String(minutes)} Min`;
  const rest = minutes % 60;
  return `${String(Math.floor(minutes / 60))} h${rest ? ` ${String(rest)} Min` : ''}`;
}

/** "8,2 km" */
export function formatDistance(meters: number | null): string | null {
  return meters === null ? null : `${km.format(meters / 1000)} km`;
}

/** "Studio · Push" / "Laufen · Outdoor" */
export function workoutTitle(workout: CalendarWorkout): string {
  return [workout.trainingType.name, workout.focus?.name ?? workout.variant]
    .filter(Boolean)
    .join(' · ');
}

/** "FitX · 58 Min · 6 Übungen" / "8,2 km · 45 Min" */
export function workoutSubtitle(workout: CalendarWorkout): string {
  const parts =
    workout.trainingType.kind === 'duration'
      ? [formatDistance(workout.distanceM), formatMinutes(workout.durationSeconds)]
      : [
          workout.locationName,
          formatMinutes(workout.durationSeconds),
          workout.exerciseCount === 1 ? '1 Übung' : `${String(workout.exerciseCount)} Übungen`,
        ];
  return parts.filter(Boolean).join(' · ');
}
