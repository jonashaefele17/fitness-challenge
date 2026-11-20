import type { PersonColorKey } from '@/shared/design-tokens';

export interface Profile {
  id: string;
  displayName: string;
  homeGym: string | null;
  color: PersonColorKey;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
}
