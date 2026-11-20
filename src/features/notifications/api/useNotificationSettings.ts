import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import { defaultPrefs, isPreset } from '../settings';
import type { NotificationCategory, NotificationPrefs, NotificationSettings } from '../types';
import { notificationKeys } from './useNotifications';

/** Categories (data), my preferences (or defaults) and my per-category overrides. */
export function useNotificationSettings() {
  const userId = useUserId();
  return useQuery({
    queryKey: notificationKeys.settings(userId),
    queryFn: async (): Promise<NotificationSettings> => {
      const [categories, prefs, overrides] = await Promise.all([
        supabase
          .from('notification_categories')
          .select('key, label, description, sort, in_important, in_standard, in_all')
          .order('sort'),
        supabase
          .from('notification_prefs')
          .select('preset, bundle, quiet_hours_enabled, quiet_start, quiet_end, time_zone')
          .maybeSingle(),
        supabase.from('notification_category_prefs').select('category, enabled'),
      ]);
      if (categories.error) throw categories.error;
      if (prefs.error) throw prefs.error;
      if (overrides.error) throw overrides.error;

      return {
        categories: categories.data.map((c): NotificationCategory => ({
          key: c.key,
          label: c.label,
          description: c.description,
          presets: { important: c.in_important, standard: c.in_standard, all: c.in_all },
        })),
        prefs: prefs.data
          ? {
              preset: isPreset(prefs.data.preset) ? prefs.data.preset : 'standard',
              bundle: prefs.data.bundle,
              quietHoursEnabled: prefs.data.quiet_hours_enabled,
              quietStart: prefs.data.quiet_start.slice(0, 5),
              quietEnd: prefs.data.quiet_end.slice(0, 5),
              timeZone: prefs.data.time_zone,
            }
          : defaultPrefs(),
        overrides: Object.fromEntries(overrides.data.map((o) => [o.category, o.enabled])),
      };
    },
  });
}

/**
 * Saves my preferences. Choosing a new preset resets the per-category overrides,
 * so the toggles reflect the preset again.
 */
export function useSaveNotificationPrefs() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const key = notificationKeys.settings(userId);

  return useMutation({
    mutationFn: async ({
      prefs,
      resetOverrides,
    }: {
      prefs: NotificationPrefs;
      resetOverrides: boolean;
    }) => {
      const { error } = await supabase.from('notification_prefs').upsert(
        {
          user_id: userId,
          preset: prefs.preset,
          bundle: prefs.bundle,
          quiet_hours_enabled: prefs.quietHoursEnabled,
          quiet_start: prefs.quietStart,
          quiet_end: prefs.quietEnd,
          time_zone: prefs.timeZone,
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
      if (resetOverrides) {
        const { error: deleteError } = await supabase
          .from('notification_category_prefs')
          .delete()
          .eq('user_id', userId);
        if (deleteError) throw deleteError;
      }
    },
    onMutate: async ({ prefs, resetOverrides }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationSettings>(key);
      if (previous) {
        queryClient.setQueryData<NotificationSettings>(key, {
          ...previous,
          prefs,
          overrides: resetOverrides ? {} : previous.overrides,
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(key, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useSetCategoryEnabled() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const key = notificationKeys.settings(userId);

  return useMutation({
    mutationFn: async ({ category, enabled }: { category: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('notification_category_prefs')
        .upsert({ user_id: userId, category, enabled }, { onConflict: 'user_id,category' });
      if (error) throw error;
    },
    onMutate: async ({ category, enabled }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationSettings>(key);
      if (previous) {
        queryClient.setQueryData<NotificationSettings>(key, {
          ...previous,
          overrides: { ...previous.overrides, [category]: enabled },
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(key, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
