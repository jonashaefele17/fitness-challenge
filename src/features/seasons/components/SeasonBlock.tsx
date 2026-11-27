import { useEffect, useState, type ReactNode } from 'react';
import { formatGoalDay, goalTodayKey, useGoalMetrics, type Goal } from '@/features/goals';
import { useActiveGroup } from '@/features/groups';
import { Button, CheckIcon, ChevronRightIcon, Sheet } from '@/shared/ui';
import { useCurrentSeason } from '../api/useSeasons';
import {
  missingMetricsText,
  seasonCountdownText,
  seasonPhaseLabel,
  seasonRulesLines,
  seasonWeekText,
} from '../format';
import { canEditMySeasonGoals } from '../season';
import { setupStarted } from '../setup';
import type { Season } from '../types';
import { SeasonEditSheet } from './SeasonEditSheet';
import { SeasonParticipantsSheet } from './SeasonParticipantsSheet';
import { SeasonSetupFlow } from './SeasonSetupFlow';

/**
 * The top of Ich → Ziele: the group's current season in one calm block – name, phase, week x
 * of y or the countdown, the rules, and where I stand – with quiet rows to everyone's goals,
 * to pauses and (admins) to change the season. No season: nothing; admins get a quiet row to
 * create one.
 */
export function SeasonBlock({
  pauses,
  goalExtra,
  openSeasonId = null,
  onLinkHandled,
}: {
  /** The pauses (ill, holiday) to show in their sheet, plugged in by the app. */
  pauses: ReactNode;
  /** Under a goal in the participants' goal detail (comments), from the app. */
  goalExtra?: (goal: Goal) => ReactNode;
  /** A season from a link: opens its setup when mine is still open. */
  openSeasonId?: string | null;
  onLinkHandled?: () => void;
}) {
  const { group } = useActiveGroup();
  const isAdmin = group.role === 'admin';
  const current = useCurrentSeason();
  const season = current.data ?? null;
  const metrics = useGoalMetrics().data ?? [];
  const metricLabel = (key: string) => metrics.find((m) => m.key === key)?.label ?? key;
  const [editing, setEditing] = useState<'new' | 'edit' | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [pausesOpen, setPausesOpen] = useState(false);

  // From a link (push, feed, Heute): open the setup once, then let the caller drop the link.
  const settled = openSeasonId !== null && !current.isPending;
  const [handled, setHandled] = useState<string | null>(null);
  if (openSeasonId === null && handled !== null) setHandled(null);
  if (settled && openSeasonId !== handled) {
    setHandled(openSeasonId);
    if (season?.id === openSeasonId && canEditMySeasonGoals(season) && !season.me?.readyAt) {
      setSetupOpen(true);
    }
  }
  useEffect(() => {
    if (settled) onLinkHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
  }, [settled, openSeasonId]);

  if (current.isPending) return null;
  const editSheet = (
    <SeasonEditSheet
      season={editing === 'edit' ? season : null}
      open={editing !== null}
      onOpenChange={(open) => {
        if (!open) setEditing(null);
      }}
    />
  );

  if (!season) {
    if (!isAdmin) return null;
    return (
      <>
        <QuietRow
          label="Saison anlegen"
          detail="Ein gemeinsamer Zeitraum mit festen Zielen"
          onClick={() => {
            setEditing('new');
          }}
          standalone
        />
        {editSheet}
      </>
    );
  }

  const live = season.phase !== 'ended' && season.phase !== 'cancelled';
  const rules = seasonRulesLines(season.rules, metricLabel);

  return (
    <section
      aria-label={`Saison ${season.name}`}
      className="flex flex-col overflow-hidden rounded-card bg-surface-2"
    >
      <div className="flex flex-col gap-1 px-4 pt-3 pb-4">
        <span className="text-footnote font-semibold text-text-muted">
          Saison · {seasonPhaseLabel(season.phase)}
        </span>
        <h2 className="text-title-3 font-semibold">{season.name}</h2>
        <p className="text-subhead text-text-muted tabular-nums">
          {seasonWeekText(season)} · {seasonCountdownText(season)}
        </p>
        {rules.length > 0 && <p className="text-footnote text-text-subtle">{rules.join(' · ')}</p>}
        <MyState
          season={season}
          metricLabel={metricLabel}
          onSetup={() => {
            setSetupOpen(true);
          }}
        />
      </div>
      <ul className="flex flex-col divide-y divide-border border-t border-border">
        <li>
          <QuietRow
            label="Alle Teilnehmer"
            value={
              season.phase === 'setup' || season.phase === 'announced'
                ? `${String(season.readyCount)} von ${String(season.participantCount)} bereit`
                : String(season.participantCount)
            }
            onClick={() => {
              setPeopleOpen(true);
            }}
          />
        </li>
        {live && season.me && (
          <li>
            <QuietRow
              label="Pause eintragen (krank, Urlaub)"
              onClick={() => {
                setPausesOpen(true);
              }}
            />
          </li>
        )}
        {isAdmin && (
          <li>
            <QuietRow
              label={live ? 'Saison bearbeiten' : 'Neue Saison anlegen'}
              onClick={() => {
                setEditing(live ? 'edit' : 'new');
              }}
            />
          </li>
        )}
      </ul>

      <SeasonSetupFlow season={season} open={setupOpen} onOpenChange={setSetupOpen} />
      <SeasonParticipantsSheet
        season={season}
        open={peopleOpen}
        onOpenChange={setPeopleOpen}
        metricLabel={metricLabel}
        {...(goalExtra ? { goalExtra } : {})}
      />
      <Sheet open={pausesOpen} onOpenChange={setPausesOpen} title="Krank oder Urlaub">
        <div className="flex flex-col gap-3 pt-1">
          <p className="text-footnote text-text-muted">
            Eine Pause gilt für deine Habits, das Trainingsziel und die Saisonregeln.
          </p>
          {pauses}
        </div>
      </Sheet>
      {editSheet}
    </section>
  );
}

/** Where I stand in the season, with the small action that fits. */
function MyState({
  season,
  metricLabel,
  onSetup,
}: {
  season: Season;
  metricLabel: (key: string) => string;
  onSetup: () => void;
}) {
  const [today] = useState(goalTodayKey);
  const me = season.me;
  if (!me) {
    return <p className="pt-2 text-subhead text-text-muted">Du nimmst nicht teil.</p>;
  }
  if (season.phase === 'announced' && !me.lateEntry) {
    return (
      <p className="pt-2 text-subhead text-text-muted">
        Einrichten ab {formatGoalDay(season.setupOpensOn, today)}
      </p>
    );
  }
  if (canEditMySeasonGoals(season)) {
    const ready = me.readyAt !== null;
    const missing = missingMetricsText(me.missingMetrics, metricLabel);
    return (
      <div className="flex flex-col items-start gap-3 pt-2">
        <p className="flex min-w-0 items-center gap-1.5 text-subhead">
          {ready && <CheckIcon aria-hidden className="shrink-0 text-accent" />}
          <span className={ready ? 'text-text' : 'text-text-muted'}>
            {ready ? 'Du bist bereit' : (missing ?? 'Noch nicht bereit')}
          </span>
        </p>
        <Button variant="tinted" className="shrink-0" onClick={onSetup}>
          {ready ? 'Ändern' : setupStarted(season.id) ? 'Setup fortsetzen' : 'Saison einrichten'}
        </Button>
      </div>
    );
  }
  if (season.phase === 'cancelled') return null;
  return (
    <p className="pt-2 text-subhead text-text-muted">
      {season.phase === 'ended'
        ? 'Die Saison ist vorbei.'
        : 'Deine Saisonziele stehen fest – unten unter „Meine Ziele“.'}
    </p>
  );
}

function QuietRow({
  label,
  detail,
  value,
  onClick,
  standalone = false,
}: {
  label: string;
  detail?: string;
  value?: string;
  onClick: () => void;
  /** On its own (no season yet): its own rounded surface. */
  standalone?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        standalone
          ? 'flex min-h-tap w-full items-center gap-3 rounded-card bg-surface-2 px-4 py-2 text-left active:bg-surface-3'
          : 'flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-3'
      }
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body">{label}</span>
        {detail && <span className="text-footnote text-text-muted">{detail}</span>}
      </span>
      {value && <span className="text-subhead text-text-muted tabular-nums">{value}</span>}
      <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
    </button>
  );
}
