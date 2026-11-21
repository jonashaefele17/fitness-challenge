import { useTrainingFocuses } from '../../api/useCatalog';

/** The template's focus (Push, Oberkörper …) as a small pill next to its name. */
export function FocusPill({ focusId }: { focusId: string | null }) {
  const focus = (useTrainingFocuses().data ?? []).find((f) => f.id === focusId);
  if (!focus) return null;
  return (
    <span className="shrink-0 rounded-pill border border-border px-2 py-0.5 text-caption font-semibold text-text-muted">
      {focus.name}
    </span>
  );
}
