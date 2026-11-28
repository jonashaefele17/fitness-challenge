import { useState, type ReactNode } from 'react';
import { useUserId } from '@/features/auth';
import { formatPercentChange } from '@/features/body';
import { useGoalMetrics, type Goal } from '@/features/goals';
import { useActiveGroup, useGroupMembers } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { personColorVar } from '@/shared/design-tokens';
import { ChevronRightIcon, LineChart } from '@/shared/ui';
import { useSeasonOverview, useSeasonStrengthWeeks } from '../api/useSeasons';
import { strengthAxisText, strengthGoalsText } from '../format';
import { meFirst, strengthGoalCount } from '../season';
import type { Season } from '../types';
import { HighlightButtons } from './HighlightButtons';
import { SeasonParticipantsSheet } from './SeasonParticipantsSheet';

/**
 * Vergleich → Kraft (the season): everyone's mean increase over their strength goals since
 * the start, a line each, and a row per participant with a strength goal – me first, no
 * ranking – with the current increase and how many strength goals it averages. Only
 * percentages: no kg, no exercises. Tapping a name highlights that line; tapping a row opens
 * the participants sheet at that person.
 */
export function SeasonStrength({
  season,
  goalExtra,
}: {
  season: Season;
  /** Under a goal in the participants' goal detail (comments), from the app. */
  goalExtra?: (goal: Goal) => ReactNode;
}) {
  const userId = useUserId();
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  const overview = useSeasonOverview(season.id);
  const strength = useSeasonStrengthWeeks(season.id);
  const metrics = useGoalMetrics().data ?? [];
  const metricLabel = (key: string) => metrics.find((m) => m.key === key)?.label ?? key;
  const [highlight, setHighlight] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const memberOf = (id: string) => members.find((m) => m.userId === id);
  const nameOf = (id: string) => (id === userId ? 'Du' : (memberOf(id)?.displayName ?? 'Jemand'));
  const rows = meFirst(overview.data ?? [], userId).filter((row) => strengthGoalCount(row) > 0);
  const pointsOf = (id: string) =>
    (strength.data ?? [])
      .filter((p) => p.userId === id)
      .map((p) => ({ onDate: p.onDate, value: p.strengthPct }));
  const lines = rows.flatMap((row) => {
    const member = memberOf(row.userId);
    const points = pointsOf(row.userId);
    return member && points.length > 0
      ? [{ key: row.userId, name: nameOf(row.userId), color: personColorVar(member.color), points }]
      : [];
  });

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-card bg-surface-2 p-4">
        <h3 className="text-subhead font-semibold">Kraftsteigerung</h3>
        {strength.isPending || overview.isPending ? (
          <div className="h-chart" aria-hidden />
        ) : (
          <>
            <LineChart
              series={lines}
              axis="percent"
              label="Kraftsteigerung seit dem Saisonstart"
              formatValue={(point) => formatPercentChange(point.value)}
              formatAxis={strengthAxisText}
              zeroLabel="0 %"
              highlight={highlight}
            />
            <HighlightButtons lines={lines} highlight={highlight} onChange={setHighlight} />
          </>
        )}
      </section>

      {rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          {rows.map((row) => {
            const member = memberOf(row.userId);
            const current = pointsOf(row.userId).at(-1)?.value ?? null;
            return (
              <li key={row.userId}>
                <button
                  type="button"
                  onClick={() => {
                    setFocus(row.userId);
                    setSheetOpen(true);
                  }}
                  className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-3"
                >
                  {member && <Avatar profile={member} size="sm" />}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-subhead font-semibold">
                      {nameOf(row.userId)}
                    </span>
                    <span className="truncate text-footnote text-text-muted">
                      {strengthGoalsText(strengthGoalCount(row))}
                    </span>
                  </span>
                  <span className="shrink-0 text-subhead font-semibold tabular-nums">
                    {formatPercentChange(current)}
                  </span>
                  <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-1 text-footnote text-text-muted">
        Steigerung seit dem Start, gemittelt über die eigenen Kraftziele · es zählt der beste Satz
        seit dem Start, ein Ziel ohne Satz mit 0 %
      </p>

      <SeasonParticipantsSheet
        season={season}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        metricLabel={metricLabel}
        focusUserId={focus}
        {...(goalExtra ? { goalExtra } : {})}
      />
    </div>
  );
}
