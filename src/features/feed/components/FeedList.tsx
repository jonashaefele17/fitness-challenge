import { useEffect, useRef, type ReactNode } from 'react';
import { useMemberLookup } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { cn, formatRelativeTime } from '@/shared/lib';
import { Button, Card } from '@/shared/ui';
import { useFeed } from '../api/useFeed';
import type { FeedEvent } from '../types';

export interface FeedListProps {
  groupId: string;
  /** Slot for social actions under each card (reactions, comment bubble …), composed in app. */
  renderActions?: (event: FeedEvent) => ReactNode;
  /** Event to scroll to and highlight (e.g. after tapping a notification). */
  highlightId?: string | null | undefined;
}

export function FeedList({ groupId, renderActions, highlightId }: FeedListProps) {
  const feed = useFeed(groupId);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;

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

  const events = feed.data?.pages.flat() ?? [];

  useEffect(() => {
    if (!highlightId) return;
    document
      .getElementById(`feed-${highlightId}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightId, events.length]);

  if (feed.isPending) return <FeedSkeleton />;
  if (feed.isError) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <p className="text-subhead text-text-muted">Der Feed konnte nicht geladen werden.</p>
        <Button variant="secondary" onClick={() => void feed.refetch()}>
          Erneut versuchen
        </Button>
      </Card>
    );
  }
  if (events.length === 0) {
    return (
      <Card className="text-subhead text-text-muted">
        Noch nichts los. Sobald jemand trainiert oder beitritt, erscheint es hier.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {events.map((event) => (
        <FeedCard
          key={event.id}
          event={event}
          highlighted={event.id === highlightId}
          actions={renderActions?.(event)}
        />
      ))}
      <div ref={sentinel} aria-hidden />
      {isFetchingNextPage && <FeedSkeleton count={1} />}
    </div>
  );
}

function FeedCard({
  event,
  highlighted,
  actions,
}: {
  event: FeedEvent;
  highlighted: boolean;
  actions: ReactNode;
}) {
  const member = useMemberLookup(event.groupId)(event.actorId);
  const name = member?.displayName ?? 'Jemand';

  return (
    <Card
      id={`feed-${event.id}`}
      className={cn(
        'flex flex-col gap-3 transition-colors duration-(--duration-base)',
        highlighted && 'border-accent',
      )}
    >
      <div className="flex items-center gap-3">
        {member && <Avatar profile={member} />}
        <div className="flex min-w-0 flex-col">
          <p className="text-subhead">
            <span className="font-semibold">{name}</span> {describeEvent(event)}
          </p>
          <p className="text-footnote text-text-subtle">{formatRelativeTime(event.createdAt)}</p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </Card>
  );
}

function describeEvent(event: FeedEvent): string {
  switch (event.type) {
    case 'member_joined':
      return 'ist der Gruppe beigetreten 👋';
    default:
      return 'hat etwas gepostet';
  }
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
