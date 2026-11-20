export interface Comment {
  id: string;
  parentId: string | null;
  authorId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  mentionIds: string[];
  /** Optimistic comment that is not saved yet. */
  pending?: boolean;
}

export interface CommentStats {
  total: number;
  unread: number;
  lastBody: string | null;
  lastAuthorId: string | null;
}

export interface PostCommentInput {
  body: string;
  parentId?: string | null | undefined;
  mentionIds: string[];
}
