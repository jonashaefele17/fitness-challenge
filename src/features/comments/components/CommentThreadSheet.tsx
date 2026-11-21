import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useUserId } from '@/features/auth';
import { useGroupMembers, type GroupMember } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { cn, formatRelativeTime } from '@/shared/lib';
import type { TargetRef } from '@/shared/types/target';
import { Button, ReplyIcon, SendIcon, Sheet } from '@/shared/ui';
import { useMarkThreadRead, usePostComment, useThread, useUpdateComment } from '../api/useComments';
import { activeMentionQuery, insertMention, resolveMentions, splitMentions } from '../mentions';
import type { Comment } from '../types';

export interface CommentThreadSheetProps {
  target: TargetRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Called after the thread was marked as read (e.g. to refresh the bell). */
  onRead?: () => void;
  /** Comment to scroll to and highlight (e.g. after tapping a notification). */
  focusCommentId?: string | null | undefined;
  /** Above the comments, e.g. reactions on the same object. */
  header?: ReactNode;
}

/** Let the sheet finish sliding in before scrolling inside it. */
const FOCUS_DELAY_MS = 350;
const HIGHLIGHT_MS = 2500;

export function CommentThreadSheet({
  target,
  open,
  onOpenChange,
  title = 'Kommentare',
  onRead,
  focusCommentId,
  header,
}: CommentThreadSheetProps) {
  const thread = useThread(target, { live: open });
  const members = useGroupMembers(target.groupId);
  const markRead = useMarkThreadRead(target);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const comments = thread.data ?? [];
  const savedCount = comments.filter((comment) => !comment.pending).length;

  // Opening the thread (and new comments arriving while it is open) marks it as read.
  const { mutate: markThreadRead } = markRead;
  useEffect(() => {
    if (!open || thread.isPending) return;
    markThreadRead(undefined, { onSuccess: () => onRead?.() });
  }, [open, thread.isPending, savedCount, markThreadRead, onRead]);

  // Scroll to the focused comment once it is loaded, then fade out its highlight.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const focusLoaded =
    open && !!focusCommentId && comments.some((comment) => comment.id === focusCommentId);
  useEffect(() => {
    if (!focusLoaded || !focusCommentId) return;
    const scroll = setTimeout(() => {
      document
        .getElementById(`comment-${focusCommentId}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setHighlightId(focusCommentId);
    }, FOCUS_DELAY_MS);
    const fade = setTimeout(() => {
      setHighlightId(null);
    }, FOCUS_DELAY_MS + HIGHLIGHT_MS);
    return () => {
      clearTimeout(scroll);
      clearTimeout(fade);
    };
  }, [focusLoaded, focusCommentId]);

  const memberList = members.data ?? [];
  const byId = new Map(memberList.map((member) => [member.userId, member]));
  const roots = comments.filter((comment) => comment.parentId === null);
  const repliesOf = (id: string) => comments.filter((comment) => comment.parentId === id);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setReplyTo(null);
        onOpenChange(next);
      }}
      title={title}
      className="min-h-sheet-min"
      footer={
        <Composer
          target={target}
          members={memberList}
          replyTo={replyTo}
          replyToName={replyTo ? byId.get(replyTo.authorId)?.displayName : undefined}
          onCancelReply={() => {
            setReplyTo(null);
          }}
          onSent={() => {
            setReplyTo(null);
          }}
        />
      }
    >
      {header && <div className="mb-4">{header}</div>}
      {thread.isPending ? (
        <p className="py-6 text-center text-subhead text-text-subtle">Lädt …</p>
      ) : roots.length === 0 ? (
        <p className="py-6 text-center text-subhead text-text-subtle">
          Noch keine Kommentare. Schreib den ersten!
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {roots.map((root) => (
            <li key={root.id} className="flex flex-col gap-3">
              <CommentItem
                comment={root}
                target={target}
                members={byId}
                highlighted={root.id === highlightId}
                onReply={() => {
                  setReplyTo(root);
                }}
              />
              {repliesOf(root.id).length > 0 && (
                <ul className="ml-11 flex flex-col gap-3 border-l border-border pl-3">
                  {repliesOf(root.id).map((reply) => (
                    <li key={reply.id}>
                      <CommentItem
                        comment={reply}
                        target={target}
                        members={byId}
                        highlighted={reply.id === highlightId}
                        onReply={() => {
                          setReplyTo(root);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function CommentItem({
  comment,
  target,
  members,
  highlighted,
  onReply,
}: {
  comment: Comment;
  target: TargetRef;
  members: Map<string, GroupMember>;
  highlighted: boolean;
  onReply: () => void;
}) {
  const userId = useUserId();
  const update = useUpdateComment(target);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const author = members.get(comment.authorId);
  const mine = comment.authorId === userId;

  if (comment.deletedAt) {
    return (
      <p id={`comment-${comment.id}`} className="text-footnote text-text-subtle italic">
        {mine ? 'Du hast diesen Kommentar gelöscht.' : 'Kommentar gelöscht.'}{' '}
        {mine && (
          <button
            type="button"
            className="min-h-tap font-semibold text-accent not-italic"
            onClick={() => {
              update.mutate({ id: comment.id, changes: { deletedAt: null } });
            }}
          >
            Rückgängig
          </button>
        )}
      </p>
    );
  }

  const names = [...members.values()].map((member) => member.displayName);

  return (
    <div
      id={`comment-${comment.id}`}
      className={cn(
        '-mx-2 flex gap-3 rounded-md px-2 py-1 transition-colors duration-(--duration-base)',
        comment.pending && 'opacity-60',
        highlighted && 'bg-accent/15',
      )}
    >
      {author ? <Avatar profile={author} size="sm" /> : <span className="size-8 shrink-0" />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-footnote text-text-subtle">
          <span className="font-semibold text-text">{author?.displayName ?? 'Jemand'}</span>{' '}
          {comment.pending ? 'wird gesendet …' : formatRelativeTime(comment.createdAt)}
          {comment.editedAt && ' · bearbeitet'}
        </p>
        {editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim().length === 0) return;
              update.mutate({ id: comment.id, changes: { body: draft } });
              setEditing(false);
            }}
          >
            <textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              rows={3}
              maxLength={2000}
              className="rounded-md border border-border bg-surface-2 p-3 text-body focus:border-accent focus:outline-none"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={draft.trim().length === 0}>
                Speichern
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(comment.body);
                }}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-body break-words whitespace-pre-wrap">
            {splitMentions(comment.body, names).map((part, index) =>
              part.mention ? (
                <span key={index} className="font-semibold text-accent">
                  {part.text}
                </span>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </p>
        )}
        {!comment.pending && !editing && (
          <div className="-ml-2 flex gap-1 text-footnote font-semibold text-text-muted">
            <button type="button" className="min-h-tap px-2" onClick={onReply}>
              Antworten
            </button>
            {mine && (
              <>
                <button
                  type="button"
                  className="min-h-tap px-2"
                  onClick={() => {
                    setDraft(comment.body);
                    setEditing(true);
                  }}
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  className="min-h-tap px-2 text-danger"
                  onClick={() => {
                    update.mutate({
                      id: comment.id,
                      changes: { deletedAt: new Date().toISOString() },
                    });
                  }}
                >
                  Löschen
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({
  target,
  members,
  replyTo,
  replyToName,
  onCancelReply,
  onSent,
}: {
  target: TargetRef;
  members: GroupMember[];
  replyTo: Comment | null;
  replyToName: string | undefined;
  onCancelReply: () => void;
  onSent: () => void;
}) {
  const userId = useUserId();
  const post = usePostComment(target);
  const [text, setText] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const others = members.filter((member) => member.userId !== userId);
  const query = activeMentionQuery(text);
  const suggestions =
    query === null
      ? []
      : others.filter((member) => member.displayName.toLowerCase().startsWith(query.toLowerCase()));

  useEffect(() => {
    if (replyTo) input.current?.focus();
  }, [replyTo]);

  function send() {
    const body = text.trim();
    if (!body) return;
    post.mutate({ body, parentId: replyTo?.id ?? null, mentionIds: resolveMentions(body, others) });
    setText('');
    onSent();
  }

  return (
    <div className="flex flex-col gap-2">
      {post.isError && (
        <p role="alert" className="text-footnote text-danger">
          Kommentar konnte nicht gesendet werden.
        </p>
      )}
      {replyTo && (
        <div className="flex items-center justify-between text-footnote text-text-muted">
          <span className="flex items-center gap-1.5">
            <ReplyIcon /> Antwort an {replyToName ?? 'Kommentar'}
          </span>
          <button type="button" className="min-h-tap px-2 font-semibold" onClick={onCancelReply}>
            Abbrechen
          </button>
        </div>
      )}
      {suggestions.length > 0 && (
        <div
          className="no-scrollbar flex gap-2 overflow-x-auto"
          role="listbox"
          aria-label="Erwähnen"
        >
          {suggestions.map((member) => (
            <button
              key={member.userId}
              type="button"
              role="option"
              aria-selected={false}
              className="flex min-h-tap shrink-0 items-center gap-2 rounded-pill bg-surface-2 pr-3 pl-1 text-subhead"
              onClick={() => {
                setText((current) => insertMention(current, member.displayName));
                input.current?.focus();
              }}
            >
              <Avatar profile={member} size="sm" />
              {member.displayName}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          ref={input}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={replyTo ? 'Antworten …' : 'Kommentieren … (@ für Erwähnung)'}
          aria-label="Kommentar"
          className="max-h-32 min-h-tap flex-1 resize-none rounded-card border border-border bg-surface-2 px-4 py-2.5 text-body placeholder:text-text-subtle focus:border-accent focus:outline-none"
        />
        <Button
          type="submit"
          aria-label="Senden"
          disabled={text.trim().length === 0}
          className="size-tap shrink-0 px-0"
        >
          <SendIcon className="text-title-3" />
        </Button>
      </form>
    </div>
  );
}
