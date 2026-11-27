import { useState } from 'react';
import type { FeedCard, FeedEvent } from '@/features/feed';
import { formatGoalDay, formatGoalPeriod, goalTodayKey, useGoalMetrics } from '@/features/goals';
import { useMemberLookup } from '@/features/groups';
import { canEditMySeasonGoals, useSeasons, type Season } from '@/features/seasons';
import { Button } from '@/shared/ui';

function field(data: unknown, key: string): unknown {
  return typeof data === 'object' && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)[key]
    : undefined;
}

const SEASON_EVENTS = [
  'season_announced',
  'season_started',
  'season_goal_corrected',
  'season_habit_changed',
];
/** Events about one person (shown also when the season was cancelled later). */
const PERSON_EVENTS = ['season_goal_corrected', 'season_habit_changed'];

/**
 * A season card's lines: a new season (with "Einrichten" for participants whose setup is
 * open), the start, an admin's correction of someone's goal (never its values) and a season
 * habit's rule changed after an admin opened it. A cancelled season says so on all of them.
 */
export function CardSeason({
  card,
  onOpenSetup,
}: {
  card: FeedCard;
  onOpenSetup: (seasonId: string) => void;
}) {
  const seasons = useSeasons().data ?? [];
  const seasonOf = (e: FeedEvent) => seasons.find((s) => s.id === field(e.data, 'seasonId'));
  const said = new Set<string>();
  const events = card.events.filter((e) => {
    if (!SEASON_EVENTS.includes(e.type)) return false;
    // A cancelled season says "abgesagt" once, not on its announcement and its start.
    const season = seasonOf(e);
    if (season?.phase !== 'cancelled' || PERSON_EVENTS.includes(e.type)) return true;
    if (said.has(season.id)) return false;
    said.add(season.id);
    return true;
  });
  if (card.kind !== 'season' || events.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {events.map((event) => {
        const season = seasonOf(event) ?? null;
        return (
          <SeasonLine
            key={event.id}
            event={event}
            card={card}
            season={season}
            onOpenSetup={onOpenSetup}
          />
        );
      })}
    </div>
  );
}

function SeasonLine({
  event,
  card,
  season,
  onOpenSetup,
}: {
  event: FeedEvent;
  card: FeedCard;
  season: Season | null;
  onOpenSetup: (seasonId: string) => void;
}) {
  const [today] = useState(goalTodayKey);
  const lookup = useMemberLookup(card.groupId);
  const metrics = useGoalMetrics().data ?? [];
  const name = season ? `„${season.name}“` : 'Die Saison';
  const cancelled = season?.phase === 'cancelled';

  let title: string;
  let detail: string | null = null;
  if (event.type === 'season_announced') {
    title = cancelled ? `Saison ${name} abgesagt` : `Neue Saison ${name}`;
    if (season && !cancelled) {
      detail = `${formatGoalPeriod(season.startsOn, season.endsOn, today)} · ${
        season.phase === 'announced'
          ? `Einrichten ab ${formatGoalDay(season.setupOpensOn, today)}`
          : season.phase === 'setup'
            ? 'Jetzt Ziele einrichten'
            : `${String(season.participantCount)} dabei`
      }`;
    }
  } else if (event.type === 'season_started') {
    title = cancelled ? `Saison ${name} abgesagt` : `${name} hat begonnen`;
    if (!cancelled) detail = 'Die Saisonziele sind jetzt festgeschrieben.';
  } else if (event.type === 'season_habit_changed') {
    const habitName = field(event.data, 'name');
    const owner = lookup(card.actorId);
    title = `${owner?.displayName ?? 'Jemand'} hat ein Saison-Habit angepasst`;
    detail =
      [
        typeof habitName === 'string' ? habitName : null,
        'Neue Regel ab heute',
        cancelled ? 'Saison abgesagt' : null,
      ]
        .filter(Boolean)
        .join(' · ') || null;
  } else {
    const ownerId = field(event.data, 'ownerId');
    const owner = typeof ownerId === 'string' ? lookup(ownerId) : undefined;
    const metric = metrics.find((m) => m.key === field(event.data, 'metric'))?.label;
    title = `Saisonziel von ${owner?.displayName ?? 'jemandem'} korrigiert`;
    detail = [metric, cancelled ? 'Saison abgesagt' : null].filter(Boolean).join(' · ') || null;
  }

  const canSetUp =
    event.type === 'season_announced' &&
    season !== null &&
    canEditMySeasonGoals(season) &&
    season.me?.readyAt === null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <p className={cancelled ? 'text-body text-text-muted' : 'text-body font-semibold'}>
          {title}
        </p>
        {detail && <p className="text-footnote text-text-muted">{detail}</p>}
      </div>
      {canSetUp && (
        <Button
          variant="tinted"
          className="shrink-0"
          onClick={() => {
            onOpenSetup(season.id);
          }}
        >
          Einrichten
        </Button>
      )}
    </div>
  );
}
