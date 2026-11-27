import { useEffect, useState } from 'react';
import { useUserId } from '@/features/auth';
import { setupPending } from '../season';
import { readSetupPrompted, writeSetupPrompted } from '../setup';
import type { Season } from '../types';

/**
 * Opens my season setup by itself once per season and device: the first time a screen
 * using this hook shows a season whose setup is open for me (catching up too) while I am
 * not ready. Any opening counts (by itself, from a link, the card or the button) – once
 * closed, only the card and the button remain. `enabled` false: not now (the screen was
 * opened for something else, e.g. a link).
 */
export function useSetupAutoOpen({
  season,
  enabled,
  open,
  setOpen,
}: {
  season: Season | null;
  enabled: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const userId = useUserId();
  const seasonId = season?.id ?? null;
  // Decided once per season and mount (state adjusted while rendering, as for links).
  const [decided, setDecided] = useState<string | null>(null);
  if (enabled && season && seasonId !== decided && setupPending(season)) {
    setDecided(seasonId);
    if (!readSetupPrompted(userId, season.id)) setOpen(true);
  }
  useEffect(() => {
    if (open && seasonId) writeSetupPrompted(userId, seasonId);
  }, [open, seasonId, userId]);
}
