import { useState, type ReactNode } from 'react';
import { useUserId } from '@/features/auth';
import { useGoalMetrics, type Goal } from '@/features/goals';
import { useActiveGroup, useGroupMembers } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { personColorVar } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';
import { ChevronRightIcon, LineChart } from '@/shared/ui';
import { useSeasonOverview, useSeasonProgressWeeks } from '../api/useSeasons';
import {
  goalDotLabel,
  goalDotState,
  overviewFigures,
  progressPctText,
  trainingWeeksText,
  type GoalDotState,
} from '../format';
import { meFirst, seasonTargetPct } from '../season';
import type { Season } from '../types';
import { SeasonParticipantsSheet } from './SeasonParticipantsSheet';

const DOT_CLASSES: Record<GoalDotState, string> = {
  reached: 'bg-accent',
  on_track: 'border-2 border-accent',
  behind: 'bg-warning',
  open: 'border border-text-subtle',
};
const DOT_ORDER: GoalDotState[] = ['reached', 'on_track', 'behind'];

function GoalDot({ state }: { state: GoalDotState }) {
  return <span aria-hidden className={cn('size-2.5 shrink-0 rounded-pill', DOT_CLASSES[state])} />;
}

/**
 * Vergleich → Übersicht (the season): everyone's goal progress as a line each against where
 * one should be by now (the dashed line), and a row per participant – me first, no ranking –
 * with the trainings weeks, a dot per season goal, the habit quota and the season's rules.
 * Tapping a name under the chart highlights that line; tapping a row opens the participants
 * sheet at that person.
 */
export function SeasonOverview({
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
  const progress = useSeasonProgressWeeks(season.id);
  const metrics = useGoalMetrics().data ?? [];
  const metricLabel = (key: string) => metrics.find((m) => m.key === key)?.label ?? key;
  const [highlight, setHighlight] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const memberOf = (id: string) => members.find((m) => m.userId === id);
  const nameOf = (id: string) => (id === userId ? 'Du' : (memberOf(id)?.displayName ?? 'Jemand'));
  const rows = meFirst(overview.data ?? [], userId);
  const lines = rows.flatMap((row) => {
    const member = memberOf(row.userId);
    const points = (progress.data ?? [])
      .filter((p) => p.userId === row.userId)
      .map((p) => ({ onDate: p.onDate, value: p.progressPct }));
    return member && points.length > 0
      ? [{ key: row.userId, name: nameOf(row.userId), color: personColorVar(member.color), points }]
      : [];
  });
  const shownDots = new Set(rows.flatMap((r) => r.goals.map(goalDotState)));

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-card bg-surface-2 p-4">
        <h3 className="text-subhead font-semibold">Zielfortschritt</h3>
        {progress.isPending || overview.isPending ? (
          <div className="h-chart" aria-hidden />
        ) : lines.length === 0 ? (
          <p className="text-footnote text-text-muted">
            Noch hat niemand ein Saisonziel mit Start und Ziel – Gewicht, Bestwert oder Körpermaß.
          </p>
        ) : (
          <>
            <LineChart
              series={lines}
              axis="progress"
              label="Zielfortschritt der Saison"
              formatValue={(point) => progressPctText(point.value)}
              formatAxis={progressPctText}
              zeroLabel="0 %"
              reference={{
                name: 'Soll',
                valueOn: (day) => seasonTargetPct(season, day),
              }}
              highlight={highlight}
            />
            <div
              role="group"
              aria-label="Person hervorheben"
              className="flex flex-wrap items-center gap-x-2 gap-y-3"
            >
              {lines.map((line) => (
                // Quiet on purpose (no accent fill): the line's own colour carries it.
                <button
                  key={line.key}
                  type="button"
                  aria-pressed={highlight === line.key}
                  onClick={() => {
                    setHighlight((current) => (current === line.key ? null : line.key));
                  }}
                  className={cn(
                    'flex min-h-tap items-center gap-2 rounded-pill border px-4 text-subhead font-semibold',
                    highlight === line.key
                      ? 'border-text-subtle bg-surface-3 text-text'
                      : 'border-border text-text-muted active:bg-surface-3',
                    highlight !== null && highlight !== line.key && 'opacity-60',
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-pill"
                    style={{ backgroundColor: line.color }}
                  />
                  {line.name}
                </button>
              ))}
              <span className="flex items-center gap-1.5 text-footnote text-text-subtle">
                <span aria-hidden className="w-4 border-t-2 border-dashed border-text-subtle" />
                Soll
              </span>
            </div>
          </>
        )}
      </section>

      {rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          {rows.map((row) => {
            const member = memberOf(row.userId);
            const figures = overviewFigures(row);
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
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-subhead font-semibold">
                        {nameOf(row.userId)}
                      </span>
                      {row.goals.length > 0 && (
                        <span className="flex shrink-0 items-center gap-1">
                          {row.goals.map((goal) => {
                            const state = goalDotState(goal);
                            return <GoalDot key={goal.goalId} state={state} />;
                          })}
                          <span className="sr-only">
                            {row.goals
                              .map(
                                (goal) =>
                                  `${metricLabel(goal.metric)}: ${goalDotLabel(goalDotState(goal))}`,
                              )
                              .join(', ')}
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="truncate text-footnote text-text-muted tabular-nums">
                      {row.trainingWeeks
                        ? trainingWeeksText(row.trainingWeeks)
                        : 'Kein Trainingsziel'}
                    </span>
                    {figures.length > 0 && (
                      // Breaks only between the parts, so nothing is cut at 375 px.
                      <span className="flex flex-wrap gap-x-3 text-footnote text-text-muted tabular-nums">
                        {figures.map((part) => (
                          <span key={part} className="whitespace-nowrap">
                            {part}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {shownDots.size > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-footnote text-text-muted">
          <span>Je Saisonziel ein Punkt:</span>
          {DOT_ORDER.map((state) => (
            <span key={state} className="flex items-center gap-1.5">
              <GoalDot state={state} />
              {goalDotLabel(state)}
            </span>
          ))}
        </p>
      )}

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
