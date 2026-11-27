import { useEffect, useState, type ReactNode } from 'react';
import { useUserId } from '@/features/auth';
import { formatGoalDay, goalTodayKey, useGoalMetrics, type Goal } from '@/features/goals';
import { useActiveGroup } from '@/features/groups';
import { HabitSheet, useMyHabits, type Habit } from '@/features/habits';
import { Button, CheckIcon, ChevronRightIcon, Sheet } from '@/shared/ui';
import { useCurrentSeason, useRefreshSeasons, useSeasonHabits } from '../api/useSeasons';
import {
  missingMetricsText,
  seasonCountdownText,
  seasonHabitEditText,
  seasonPhaseLabel,
  seasonRulesLines,
  seasonWeekText,
} from '../format';
import { canEditMySeasonGoals, catchingUp, setupPending } from '../season';
import { setupStarted } from '../setup';
import type { Season } from '../types';
import { SeasonEditSheet } from './SeasonEditSheet';
import { SeasonParticipantsSheet } from './SeasonParticipantsSheet';
import { SeasonSetupFlow } from './SeasonSetupFlow';
import { useSetupAutoOpen } from './useSetupAutoOpen';

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
  autoOpenSetup = false,
}: {
  /** The pauses (ill, holiday) to show in their sheet, plugged in by the app. */
  pauses: ReactNode;
  /** Under a goal in the participants' goal detail (comments), from the app. */
  goalExtra?: (goal: Goal) => ReactNode;
  /** A season from a link: opens its setup when mine is still open. */
  openSeasonId?: string | null;
  onLinkHandled?: () => void;
  /** Open my pending setup by itself (once per season and device, see useSetupAutoOpen). */
  autoOpenSetup?: boolean;
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
  const userId = useUserId();
  // My season habits an admin opened for a change: a row each, straight to the habit.
  const seasonHabits = useSeasonHabits(season?.me ? season.id : null).data ?? [];
  const myHabits = useMyHabits().data ?? [];
  const refresh = useRefreshSeasons();
  const [habitOpen, setHabitOpen] = useState<Habit | null>(null);
  const openForChange = seasonHabits.filter((h) => h.userId === userId && h.editOpenUntil);

  // From a link (push, feed, Heute): open the setup once, then let the caller drop the link.
  const settled = openSeasonId !== null && !current.isPending;
  const [handled, setHandled] = useState<string | null>(null);
  if (openSeasonId === null && handled !== null) setHandled(null);
  if (settled && openSeasonId !== handled) {
    setHandled(openSeasonId);
    if (season?.id === openSeasonId && setupPending(season)) {
      setSetupOpen(true);
    }
  }
  useEffect(() => {
    if (settled) onLinkHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
  }, [settled, openSeasonId]);

  // A season I just created: my setup opens right away once it shows (when I take part).
  const [created, setCreated] = useState<string | null>(null);
  if (created !== null && season?.id === created) {
    setCreated(null);
    if (setupPending(season)) setSetupOpen(true);
  }
  useSetupAutoOpen({
    season,
    enabled: autoOpenSetup && openSeasonId === null,
    open: setupOpen,
    setOpen: setSetupOpen,
  });

  if (current.isPending) return null;
  const editSheet = (
    <SeasonEditSheet
      season={editing === 'edit' ? season : null}
      open={editing !== null}
      onOpenChange={(open) => {
        if (!open) setEditing(null);
      }}
      onCreated={setCreated}
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
        {live &&
          openForChange.map((h) => {
            const habit = myHabits.find((x) => x.id === h.habitId);
            return habit && h.editOpenUntil ? (
              <li key={h.habitId}>
                <QuietRow
                  label={`${h.definition.name}: Regel ändern`}
                  detail={seasonHabitEditText(h.editOpenUntil)}
                  onClick={() => {
                    setHabitOpen(habit);
                  }}
                />
              </li>
            ) : null;
          })}
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
      <HabitSheet
        open={habitOpen !== null}
        onOpenChange={(open) => {
          if (!open) setHabitOpen(null);
        }}
        habit={habitOpen}
        onSaved={() => {
          void refresh();
        }}
      />
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
    if (ready) {
      return (
        <div className="flex flex-col items-start gap-3 pt-2">
          <p className="flex min-w-0 items-center gap-1.5 text-subhead">
            <CheckIcon aria-hidden className="shrink-0 text-accent" />
            <span className="text-text">Du bist bereit</span>
          </p>
          <Button variant="tinted" className="shrink-0" onClick={onSetup}>
            Ändern
          </Button>
        </div>
      );
    }
    const missing = missingMetricsText(me.missingMetrics, metricLabel);
    const catchUp = catchingUp(season);
    const goalsMissing = me.missingMetrics.length > 0;
    return (
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex flex-col">
          {catchUp && (
            <p className="text-subhead font-semibold">
              {goalsMissing
                ? 'Saison läuft – deine Ziele fehlen noch'
                : 'Saison läuft – du bist noch nicht bereit'}
            </p>
          )}
          <p className="text-subhead text-text-muted">{missing ?? 'Noch nicht bereit'}</p>
        </div>
        <Button variant="tinted" fullWidth onClick={onSetup}>
          {catchUp && goalsMissing
            ? 'Jetzt einrichten'
            : setupStarted(season.id)
              ? 'Setup fortsetzen'
              : 'Saison einrichten'}
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
