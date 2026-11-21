import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import type { Device, DeviceSettingValues, DeviceWithExercises, Place } from '../types';
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
        .select(
          'id, name, weight_step, comparable, setting_fields, device_exercises(exercises(id, name, measure))',
        )
        .eq('location_id', locationId)
        .order('name');
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        name: row.name,
        weightStep: row.weight_step,
        comparable: row.comparable,
        settingFields: row.setting_fields,
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
          setting_fields: device.settingFields,
        })
        .eq('id', device.id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: trainingKeys.all(userId) }),
  });
}

/** My values for a device and exercise, e.g. { "Rückenlehne": "3" }. */
export function useDeviceSetting(deviceId: string | null, exerciseId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: placeKeys.setting(userId, deviceId ?? 'none', exerciseId),
    enabled: deviceId !== null,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<DeviceSettingValues> => {
      if (!deviceId) return {};
      const { data, error } = await supabase
        .from('user_device_settings')
        .select('values')
        .eq('device_id', deviceId)
        .eq('exercise_id', exerciseId)
        .maybeSingle();
      if (error) throw error;
      const values: DeviceSettingValues = {};
      const raw = data?.values;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [field, value] of Object.entries(raw)) {
          if (typeof value === 'string' && value.trim()) values[field] = value;
        }
      }
      return values;
    },
  });
}

export function useSaveDeviceSetting(deviceId: string, exerciseId: string) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const key = placeKeys.setting(userId, deviceId, exerciseId);
  return useMutation({
    mutationFn: async (values: DeviceSettingValues) => {
      const cleaned = Object.fromEntries(
        Object.entries(values)
          .map(([field, value]) => [field, value.trim()] as const)
          .filter(([, value]) => value.length > 0),
      );
      const { error } =
        Object.keys(cleaned).length > 0
          ? await supabase
              .from('user_device_settings')
              .upsert(
                { user_id: userId, device_id: deviceId, exercise_id: exerciseId, values: cleaned },
                { onConflict: 'user_id,device_id,exercise_id' },
              )
          : await supabase
              .from('user_device_settings')
              .delete()
              .eq('device_id', deviceId)
              .eq('exercise_id', exerciseId);
      if (error) throw error;
    },
    onMutate: (values) => {
      queryClient.setQueryData(key, values);
    },
  });
}

/** "Rückenlehne 3 · Beinpolster 5" in the device's field order. */
export function formatSettingValues(fields: string[], values: DeviceSettingValues): string {
  return fields
    .filter((field) => values[field])
    .map((field) => `${field} ${values[field] ?? ''}`)
    .join(' · ');
}

export interface CreateDeviceInput {
  locationId: string;
  name: string;
  weightStep: number | null;
  comparable: boolean;
  /** Exercise to link to the new device. */
  exerciseId: string;
}

/** Adds a device at a place and links the exercise to it. */
export function useCreateDevice() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: CreateDeviceInput): Promise<Device> => {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('devices').insert({
        id,
        location_id: input.locationId,
        name: input.name.trim(),
        weight_step: input.weightStep,
        comparable: input.comparable,
        created_by: userId,
      });
      if (error) throw error;
      const { error: linkError } = await supabase
        .from('device_exercises')
        .insert({ device_id: id, exercise_id: input.exerciseId });
      if (linkError) throw linkError;
      return {
        id,
        name: input.name.trim(),
        weightStep: input.weightStep,
        comparable: input.comparable,
        settingFields: [],
      };
    },
    onSuccess: (_device, input) =>
      queryClient.invalidateQueries({ queryKey: placeKeys.devices(userId, input.locationId) }),
  });
}

/** Links an exercise to a device (best effort: only the device's editors may). */
export async function linkExerciseToDevice(deviceId: string, exerciseId: string) {
  await supabase
    .from('device_exercises')
    .upsert({ device_id: deviceId, exercise_id: exerciseId }, { ignoreDuplicates: true });
}

/** Adds an exercise to a device (e.g. Kabelturm + Face Pulls). */
export function useLinkExercise(locationId: string) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ deviceId, exerciseId }: { deviceId: string; exerciseId: string }) => {
      const { error } = await supabase
        .from('device_exercises')
        .upsert({ device_id: deviceId, exercise_id: exerciseId }, { ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: placeKeys.devices(userId, locationId) }),
  });
}

/** Adds an empty device at a place (exercises are linked afterwards). */
export function useCreateEmptyDevice(locationId: string) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      weightStep: number | null;
      comparable: boolean;
    }): Promise<Device> => {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('devices').insert({
        id,
        location_id: locationId,
        name: input.name.trim(),
        weight_step: input.weightStep,
        comparable: input.comparable,
        created_by: userId,
      });
      if (error) throw error;
      return {
        id,
        name: input.name.trim(),
        weightStep: input.weightStep,
        comparable: input.comparable,
        settingFields: [],
      };
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: placeKeys.devices(userId, locationId) }),
  });
}
