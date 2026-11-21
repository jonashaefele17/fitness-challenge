import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMemberLookup } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { spring } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';
import { Button, Card, ChevronDownIcon } from '@/shared/ui';
import { feedKeys, useFeed } from '../api/useFeed';
import { markFeedSeen, useNewPosts } from '../api/useFeedRealtime';
import { dayLabel } from '../dayLabel';
import type { FeedCard, FeedSort } from '../types';

const SORT_KEY = 'feed.sort';
/** Within this distance from the top, new posts are shown right away. */
const TOP_PX = 80;

function readSort(): FeedSort {
  try {
    return localStorage.getItem(SORT_KEY) === 'active' ? 'active' : 'newest';
  } catch {
    return 'newest';
  }
}

export interface FeedListProps {
  groupId: string;
  /** What the card shows for its events (workouts …), composed in app. */
  renderBody?: (card: FeedCard) => ReactNode;
  /** Social actions under each card (reactions, comment bubble …), composed in app. */
  renderActions?: (card: FeedCard) => ReactNode;
  /** Card (or event on it) to scroll to and highlight, e.g. after tapping a notification. */
  highlightId?: string | null | undefined;
}

/** The group's day cards: one per person and day, newest or most recently active first. */
export function FeedList({ groupId, renderBody, renderActions, highlightId }: FeedListProps) {
  const [sort, setSortState] = useState<FeedSort>(readSort);
  const feed = useFeed(groupId, sort);
  const queryClient = useQueryClient();
  const hasNew = useNewPosts(groupId);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  const cards = feed.data?.pages.flat() ?? [];

  function setSort(next: FeedSort) {
    setSortState(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // Remembering the sort is a convenience only.
    }
  }

  function showNew() {
    markFeedSeen(groupId);
    void queryClient.invalidateQueries({ queryKey: feedKeys.all(groupId) });
  }

  // New posts while at the top: show them at once; further down the pill offers them.
  useEffect(() => {
    if (hasNew && window.scrollY < TOP_PX) showNew();
  });

  // Endless scroll: load the next page when the sentinel comes into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const highlighted = highlightId
    ? (cards.find(
        (card) => card.id === highlightId || card.events.some((e) => e.id === highlightId),
      )?.id ?? null)
    : null;

  useEffect(() => {
    if (!highlighted) return;
    document
      .getElementById(`feed-${highlighted}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlighted]);

  return (
    <div className="flex flex-col gap-3">
      <div className="-mb-2 flex items-center justify-between">
        <h2 className="text-footnote font-semibold text-text-muted">Beiträge</h2>
        <button
          type="button"
          onClick={() => {
            setSort(sort === 'newest' ? 'active' : 'newest');
          }}
          className="-mr-2 flex min-h-tap items-center gap-1 rounded-pill px-2 text-footnote font-semibold text-text-muted active:bg-surface-2"
        >
          {sort === 'newest' ? 'Neueste' : 'Zuletzt aktiv'}
          <ChevronDownIcon aria-hidden />
        </button>
      </div>

      <AnimatePresence>
        {hasNew && (
          <motion.button
            type="button"
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={spring.snappy}
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              showNew();
            }}
            className="fixed top-toast left-1/2 z-20 flex min-h-tap -translate-x-1/2 items-center rounded-pill glass px-4 text-subhead font-semibold text-accent"
          >
            ↑ Neue Beiträge
          </motion.button>
        )}
      </AnimatePresence>

      {feed.isPending ? (
        <FeedSkeleton />
      ) : feed.isError ? (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-subhead text-text-muted">Der Feed konnte nicht geladen werden.</p>
          <Button variant="secondary" onClick={() => void feed.refetch()}>
            Erneut versuchen
          </Button>
        </Card>
      ) : cards.length === 0 ? (
        <Card className="text-subhead text-text-muted">
          Noch nichts los. Sobald jemand trainiert oder beitritt, erscheint es hier.
        </Card>
      ) : (
        cards.map((card) => (
          <FeedDayCard
            key={card.id}
            card={card}
            highlighted={card.id === highlighted}
            body={renderBody?.(card)}
            actions={renderActions?.(card)}
          />
        ))
      )}
      <div ref={sentinel} aria-hidden />
      {isFetchingNextPage && <FeedSkeleton count={1} />}
    </div>
  );
}

function FeedDayCard({
  card,
  highlighted,
  body,
  actions,
}: {
  card: FeedCard;
  highlighted: boolean;
  body: ReactNode;
  actions: ReactNode;
}) {
  const member = useMemberLookup(card.groupId)(card.actorId);
  const name = member?.displayName ?? 'Jemand';
  const workouts = card.events.filter((event) => event.type === 'workout_finished');
  // Logged long after: shown on its day, but marked (and nobody was notified).
  const late =
    workouts.length > 0 &&
    workouts.every(
      (event) =>
        typeof event.data === 'object' &&
        event.data !== null &&
        !Array.isArray(event.data) &&
        event.data.late === true,
    );
  const joined = card.events.some((event) => event.type === 'member_joined');

  return (
    <Card
      id={`feed-${card.id}`}
      className={cn(
        'flex flex-col gap-3 transition-colors duration-(--duration-base)',
        highlighted && 'border-accent',
      )}
    >
      <div className="flex items-center gap-3">
        {member && <Avatar profile={member} />}
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-subhead font-semibold">{name}</p>
          <p className="text-footnote text-text-subtle">
            {dayLabel(card.day)}
            {late ? ' · nachgetragen' : ''}
          </p>
        </div>
      </div>
      {body}
      {joined && <p className="text-subhead text-text-muted">ist der Gruppe beigetreten 👋</p>}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </Card>
  );
}

function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="flex items-center gap-3">
          <span className="size-10 animate-pulse rounded-pill bg-surface-3" />
          <span className="h-4 flex-1 animate-pulse rounded-sm bg-surface-3" />
        </Card>
      ))}
    </div>
  );
}
