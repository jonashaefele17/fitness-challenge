/** Keys of the person colour tokens (--color-person-N). Stored in profiles.color. */
export const personColorKeys = [
  'person-1',
  'person-2',
  'person-3',
  'person-4',
  'person-5',
  'person-6',
  'person-7',
  'person-8',
] as const;

export type PersonColorKey = (typeof personColorKeys)[number];

export function isPersonColorKey(value: string): value is PersonColorKey {
  return (personColorKeys as readonly string[]).includes(value);
}

/** CSS colour value for a person colour key, for inline styles (e.g. avatar rings). */
export function personColorVar(key: PersonColorKey): string {
  return `var(--color-${key})`;
}
