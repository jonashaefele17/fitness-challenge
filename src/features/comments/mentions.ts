export interface Mentionable {
  userId: string;
  displayName: string;
}

/** The "@query" being typed at the end of the text, or null. */
export function activeMentionQuery(text: string): string | null {
  const match = /(?:^|\s)@([\p{L}\p{N}_-]*)$/u.exec(text);
  return match ? (match[1] ?? '') : null;
}

/** Replaces the trailing "@query" with "@Name ". */
export function insertMention(text: string, name: string): string {
  return text.replace(/@[\p{L}\p{N}_-]*$/u, `@${name} `);
}

/** Members whose "@Name" still appears in the text (mentions removed by editing are dropped). */
export function resolveMentions(text: string, candidates: Mentionable[]): string[] {
  return candidates
    .filter((member) => text.includes(`@${member.displayName}`))
    .map((member) => member.userId);
}

/** Splits a comment body into plain text and "@Name" parts for highlighting. */
export function splitMentions(body: string, names: string[]): { text: string; mention: boolean }[] {
  const sorted = [...names].sort((a, b) => b.length - a.length).filter(Boolean);
  if (sorted.length === 0) return [{ text: body, mention: false }];
  const escaped = sorted.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(@(?:${escaped.join('|')}))`, 'u');
  const known = new Set(sorted);
  return body
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, mention: part.startsWith('@') && known.has(part.slice(1)) }));
}
