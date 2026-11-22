import { Button } from '@/shared/ui';
import { useLoadPlanSeries } from '../../api/usePlans';
import { buildIcs, downloadIcs } from '../../ics';
import type { PlanOccurrence } from '../../types';
import { planTitle } from './planText';

/**
 * "In Kalender übernehmen": a calendar file the phone offers to add. A copy, so the hint
 * says that later changes do not follow. A series goes whole or only this date.
 */
export function CalendarExport({ plan, onDone }: { plan: PlanOccurrence; onDone: () => void }) {
  const series = useLoadPlanSeries();

  function single() {
    downloadIcs(
      `${planTitle(plan)} ${plan.onDate}.ics`,
      buildIcs([
        {
          uid: `${plan.planId}-${plan.planDate}@fitness-challenge`,
          summary: [planTitle(plan), plan.focus?.name].filter(Boolean).join(' · '),
          description: plan.note,
          date: plan.onDate,
          time: plan.startTime,
        },
      ]),
    );
    onDone();
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <p className="text-subhead text-text-muted">
        Dein Handy fragt, ob es den Termin in deinen Kalender eintragen soll. Das ist eine einmalige
        Kopie: Änderungen in der App kommen nicht automatisch in deinen Kalender.
      </p>
      {series.isError && (
        <p role="alert" className="text-footnote text-danger">
          Die Serie konnte nicht geladen werden.
        </p>
      )}
      {plan.recurring ? (
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            loading={series.isPending}
            onClick={() => {
              series.mutate(plan, {
                onSuccess: (events) => {
                  downloadIcs(`${planTitle(plan)}.ics`, buildIcs(events));
                  onDone();
                },
              });
            }}
          >
            Ganze Serie
          </Button>
          <Button variant="secondary" size="lg" onClick={single}>
            Nur dieser Termin
          </Button>
        </div>
      ) : (
        <Button size="lg" onClick={single}>
          Zum Kalender hinzufügen
        </Button>
      )}
    </div>
  );
}
