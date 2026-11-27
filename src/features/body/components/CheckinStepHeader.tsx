import { ChevronLeftIcon } from '@/shared/ui';

/** Top line of a flow screen: "Zurück" on the left, a counter on the right. */
export function CheckinStepHeader({
  onBack,
  counter,
}: {
  onBack: (() => void) | undefined;
  counter: string | null;
}) {
  return (
    <div className="flex min-h-tap items-center justify-between">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 flex min-h-tap items-center gap-1 rounded-pill px-2 text-subhead font-semibold text-accent active:bg-surface-2"
        >
          <ChevronLeftIcon aria-hidden /> Zurück
        </button>
      ) : (
        <span />
      )}
      {counter && <span className="text-footnote text-text-muted">{counter}</span>}
    </div>
  );
}
