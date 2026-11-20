import { createContext, useContext, type ReactNode } from 'react';
import type { GroupMembership } from '../types';

interface ActiveGroupContextValue {
  group: GroupMembership;
  groups: GroupMembership[];
}

const ActiveGroupContext = createContext<ActiveGroupContextValue | null>(null);

export interface ActiveGroupProviderProps {
  /** The user's memberships; must not be empty. */
  groups: GroupMembership[];
  children: ReactNode;
}

/**
 * Provides the active group context. For now it is simply the first (oldest) membership;
 * a group switcher can later store the chosen id and pick it here.
 */
export function ActiveGroupProvider({ groups, children }: ActiveGroupProviderProps) {
  const group = groups[0];
  if (!group) throw new Error('ActiveGroupProvider needs at least one group.');
  return (
    <ActiveGroupContext.Provider value={{ group, groups }}>{children}</ActiveGroupContext.Provider>
  );
}

/**
 * The group all group-scoped queries must use (take groupId from here, never hard-code it,
 * and include it in the query key via groupKeys.scope(groupId)).
 */
export function useActiveGroup(): ActiveGroupContextValue {
  const value = useContext(ActiveGroupContext);
  if (!value) throw new Error('useActiveGroup must be used inside <ActiveGroupProvider>.');
  return value;
}
