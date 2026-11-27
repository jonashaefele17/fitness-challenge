import { useState } from 'react';
import { useNavigate } from 'react-router';
import { addGoalDays, goalTodayKey } from '@/features/goals';
import { canEditMySeasonGoals, useCurrentSeason } from '@/features/seasons';
import { Button, FinishFlagIcon, FlagIcon, ScaleIcon } from '@/shared/ui';
import { useDayMarkers } from '../calendar/useDayMarkers';
import { paths } from '../paths';
import { targetParams } from '../targets';
import { setupCardText, upcomingLines } from './upcoming';

/** Heute looks this far ahead for special days. */
const AHEAD_DAYS = 7;

/**
 * Heute: one calm card for what is coming – while my season setup is open and I am not
 * ready, "Saison einrichten" with a small button; below it special days just ahead
 * ("Morgen Wiegetag", "Noch 5 Tage bis Saisonende"). Nothing otherwise.
 */
export function TodayUpcoming() {
  const [today] = useState(goalTodayKey);
  const navigate = useNavigate();
  const season = useCurrentSeason().data ?? null;
  const markers = useDayMarkers(today, addGoalDays(today, AHEAD_DAYS));
  const setup =
    season !== null && canEditMySeasonGoals(season) && season.me?.readyAt === null ? season : null;
  const lines = upcomingLines(markers, today, { setupCardShown: setup !== null });
  if (!setup && lines.length === 0) return null;

  return (
    <section
      aria-label="Demnächst"
      className="flex flex-col divide-y divide-border rounded-card bg-surface-2"
    >
      {setup && (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-body font-semibold">Saison einrichten</span>
            <span className="text-footnote text-text-muted">{setupCardText(setup)}</span>
          </div>
          <Button
            variant="tinted"
            className="shrink-0"
            onClick={() =>
              void navigate(
                `${paths.me}?${new URLSearchParams({ [targetParams.season]: setup.id }).toString()}`,
              )
            }
          >
            Einrichten
          </Button>
        </div>
      )}
      {lines.length > 0 && (
        <ul className="flex flex-col gap-1 px-4 py-2.5">
          {lines.map((line) => {
            const Icon =
              line.kind === 'season_end'
                ? FinishFlagIcon
                : line.kind === 'season_start'
                  ? FlagIcon
                  : ScaleIcon;
            return (
              <li key={line.key} className="flex min-h-8 items-center gap-2 text-subhead">
                <Icon
                  aria-hidden
                  className={
                    line.kind === 'season_end'
                      ? 'shrink-0 text-accent'
                      : 'shrink-0 text-text-subtle'
                  }
                />
                <span className="text-text-muted">{line.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
