import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import type { Device, DeviceWithExercises, Place } from '../types';
import { trainingKeys } from './keys';

const placeKeys = {
  places: (userId: string) => [...trainingKeys.all(userId), 'places'] as const,
  prefs: (userId: string) => [...trainingKeys.all(userId), 'prefs'] as const,
  devices: (userId: string, locationId: string) =>
    [...trainingKeys.all(userId), 'devices', locationId] as const,
  setting: (userId: string, deviceId: string, exerciseId: string) =>
    [...trainingKeys.all(userId), 'setting', deviceId, exerciseId] as const,
};

/** Public studios plus my own private places. */
export function usePlaces() {
  const userId = useUserId();
  return useQuery({
    queryKey: placeKeys.places(userId),
    queryFn: async (): Promise<Place[]> => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, owner_id')
        .or(`owner_id.is.null,owner_id.eq.${userId}`)
        .order('name');
      if (error) throw error;
      return data.map((row) => ({ id: row.id, name: row.name, private: row.owner_id === userId }));
    },
  });
}

export function useCreatePlace() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({
      name,
      isPrivate,
    }: {
      name: string;
      isPrivate: boolean;
    }): Promise<Place> => {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('locations').insert({
        id,
        name: name.trim(),
        owner_id: isPrivate ? userId : null,
        created_by: userId,
      });
      if (error) throw error;
      return { id, name: name.trim(), private: isPrivate };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: placeKeys.places(userId) }),
  });
}

export function useHomeStudio() {
  const userId = useUserId();
  return useQuery({
    queryKey: placeKeys.prefs(userId),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('training_prefs')
        .select('home_location_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.home_location_id ?? null;
    },
  });
}

export function useSetHomeStudio() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (locationId: string) => {
      const { error } = await supabase
        .from('training_prefs')
        .upsert({ user_id: userId, home_location_id: locationId }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: (_data, locationId) => {
      queryClient.setQueryData(placeKeys.prefs(userId), locationId);
    },
  });
}

/** Devices at a place with the exercises they offer. */
export function useDevicesAt(locationId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: placeKeys.devices(userId, locationId ?? 'none'),
    enabled: locationId !== null,
    queryFn: async (): Promise<DeviceWithExercises[]> => {
      if (!locationId) return [];
      const { data, error } = await supabase
        .from('devices')
        .select('id, name, weight_step, comparable, device_exercises(exercises(id, name, measure))')
        .eq('location_id', locationId)
        .order('name');
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        name: row.name,
        weightStep: row.weight_step,
        comparable: row.comparable,
        exercises: row.device_exercises
          .map((link) => link.exercises)
          .map((exercise) => ({ id: exercise.id, name: exercise.name, measure: exercise.measure }))
          .sort((a, b) => a.name.localeCompare(b.name, 'de')),
      }));
    },
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (device: Device) => {
      const { error } = await supabase
        .from('devices')
        .update({
          name: device.name.trim(),
          weight_step: device.weightStep,
          comparable: device.comparable,
        })
        .eq('id', device.id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: trainingKeys.all(userId) }),
  });
}

/** My setting for a device and exercise, e.g. "Sitz 4". */
export function useDeviceSetting(deviceId: string | null, exerciseId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: placeKeys.setting(userId, deviceId ?? 'none', exerciseId),
    enabled: deviceId !== null,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<string | null> => {
      if (!deviceId) return null;
      const { data, error } = await supabase
        .from('user_device_settings')
        .select('setting')
        .eq('device_id', deviceId)
        .eq('exercise_id', exerciseId)
        .maybeSingle();
      if (error) throw error;
      return data?.setting ?? null;
    },
  });
}

export function useSaveDeviceSetting(deviceId: string, exerciseId: string) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const key = placeKeys.setting(userId, deviceId, exerciseId);
  return useMutation({
    mutationFn: async (setting: string) => {
      const value = setting.trim();
      const { error } = value
        ? await supabase
            .from('user_device_settings')
            .upsert(
              { user_id: userId, device_id: deviceId, exercise_id: exerciseId, setting: value },
              { onConflict: 'user_id,device_id,exercise_id' },
            )
        : await supabase
            .from('user_device_settings')
            .delete()
            .eq('device_id', deviceId)
            .eq('exercise_id', exerciseId);
      if (error) throw error;
    },
    onMutate: (setting) => {
      queryClient.setQueryData(key, setting.trim() || null);
    },
  });
}
