import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import type {
  Device,
  DeviceSettingValues,
  DeviceType,
  DeviceWithExercises,
  ExerciseSummary,
  Place,
} from '../types';
import { byName, DEVICE_COLUMNS, toDevice, toExercise } from './deviceRow';
import { trainingKeys } from './keys';

const placeKeys = {
  places: (userId: string) => [...trainingKeys.all(userId), 'places'] as const,
  prefs: (userId: string) => [...trainingKeys.all(userId), 'prefs'] as const,
  devices: (userId: string, locationId: string) =>
    [...trainingKeys.all(userId), 'devices', locationId] as const,
  deviceTypes: (userId: string) => [...trainingKeys.all(userId), 'device-types'] as const,
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

// ---------------------------------------------------------------------------
// Devices (instances of a type at a place) and the type catalogue
// ---------------------------------------------------------------------------

/** Devices at a place with the exercises their type offers here. */
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
          `${DEVICE_COLUMNS}, links:device_types!inner(device_type_exercises(exercises!inner(id, name, measure))), device_hidden_exercises(exercise_id)`,
        )
        .eq('location_id', locationId);
      if (error) throw error;
      return data
        .map((row): DeviceWithExercises => {
          const hidden = new Set(row.device_hidden_exercises.map((h) => h.exercise_id));
          const all = row.links.device_type_exercises
            .map((link) => toExercise(link.exercises))
            .sort(byName);
          return {
            ...toDevice(row),
            exercises: all.filter((exercise) => !hidden.has(exercise.id)),
            hiddenExercises: all.filter((exercise) => hidden.has(exercise.id)),
          };
        })
        .sort(byName);
    },
  });
}

/** The global catalogue of device types with their exercises. */
export function useDeviceTypes() {
  const userId = useUserId();
  return useQuery({
    queryKey: placeKeys.deviceTypes(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DeviceType[]> => {
      const { data, error } = await supabase
        .from('device_types')
        .select(
          'id, name, default_weight_step, comparable, setting_fields, device_type_exercises(exercises!inner(id, name, measure))',
        );
      if (error) throw error;
      return data
        .map((row): DeviceType => ({
          id: row.id,
          name: row.name,
          weightStep: row.default_weight_step,
          comparable: row.comparable,
          settingFields: row.setting_fields,
          exercises: row.device_type_exercises
            .map((link) => toExercise(link.exercises))
            .sort(byName),
        }))
        .sort(byName);
    },
  });
}

/** How often each exercise shows up in the workouts I can see (mine and my group's). */
export function useExercisePopularity() {
  const userId = useUserId();
  return useQuery({
    queryKey: [...trainingKeys.all(userId), 'popularity'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.rpc('exercise_popularity');
      if (error) throw error;
      return new Map(data.map((row) => [row.exercise_id, row.uses]));
    },
  });
}

/** Devices, the type catalogue and the running workout all show device data. */
function invalidateDevices(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'training' &&
      query.queryKey[1] === userId &&
      ['devices', 'device-types', 'active'].includes(String(query.queryKey[2])),
  });
}

/**
 * Saves a device: name, setting fields and comparability belong to the type (shared by all
 * places); the weight step is stored on the device only when it differs from the type's.
 */
export function useUpdateDevice() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ before, after }: { before: Device; after: Device }) => {
      if (
        after.name.trim() !== before.name ||
        after.comparable !== before.comparable ||
        after.settingFields.join('\n') !== before.settingFields.join('\n')
      ) {
        const { error } = await supabase
          .from('device_types')
          .update({
            name: after.name.trim(),
            comparable: after.comparable,
            setting_fields: after.settingFields,
          })
          .eq('id', before.typeId);
        if (error) throw error;
      }
      if (after.weightStep !== before.weightStep) {
        const { error } = await supabase
          .from('devices')
          .update({
            weight_step: after.weightStep === before.typeWeightStep ? null : after.weightStep,
          })
          .eq('id', before.id);
        if (error) throw error;
      }
    },
    onSettled: () => invalidateDevices(queryClient, userId),
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

export interface NewDeviceType {
  name: string;
  weightStep: number | null;
  comparable: boolean;
}

/**
 * Sets up a place: adds devices of the chosen types (types already there are kept), and
 * optionally a brand-new type. Resolves to the device id per type id.
 */
export function useAddDevices(locationId: string) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: {
      typeIds: string[];
      newType?: NewDeviceType | undefined;
    }): Promise<Map<string, string>> => {
      const typeIds = [...input.typeIds];
      if (input.newType) {
        const id = crypto.randomUUID();
        const { error } = await supabase.from('device_types').insert({
          id,
          name: input.newType.name.trim(),
          default_weight_step: input.newType.weightStep,
          comparable: input.newType.comparable,
          created_by: userId,
        });
        if (error) throw error;
        typeIds.push(id);
      }
      const { data: existing, error: readError } = await supabase
        .from('devices')
        .select('id, device_type_id')
        .eq('location_id', locationId)
        .in('device_type_id', typeIds);
      if (readError) throw readError;
      const ids = new Map(existing.map((row) => [row.device_type_id, row.id]));
      const rows = typeIds
        .filter((typeId) => !ids.has(typeId))
        .map((typeId) => {
          const id = crypto.randomUUID();
          ids.set(typeId, id);
          return { id, location_id: locationId, device_type_id: typeId, created_by: userId };
        });
      if (rows.length > 0) {
        const { error } = await supabase.from('devices').insert(rows);
        if (error) throw error;
      }
      return ids;
    },
    onSettled: () => invalidateDevices(queryClient, userId),
  });
}

/** Adds an exercise to a device type (best effort; it becomes available at every place). */
export async function linkExerciseToType(typeId: string, exerciseId: string) {
  await supabase
    .from('device_type_exercises')
    .upsert({ device_type_id: typeId, exercise_id: exerciseId }, { ignoreDuplicates: true });
}

/** Adds an exercise to a device's type (e.g. Kabelturm + Face Pulls) and offers it here. */
export function useLinkExercise() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ device, exerciseId }: { device: Device; exerciseId: string }) => {
      const { error } = await supabase
        .from('device_type_exercises')
        .upsert(
          { device_type_id: device.typeId, exercise_id: exerciseId },
          { ignoreDuplicates: true },
        );
      if (error) throw error;
      const { error: unhideError } = await supabase
        .from('device_hidden_exercises')
        .delete()
        .eq('device_id', device.id)
        .eq('exercise_id', exerciseId);
      if (unhideError) throw unhideError;
    },
    onSettled: () => invalidateDevices(queryClient, userId),
  });
}

/** Marks an exercise as (not) available at a device, e.g. no rope here for face pulls. */
export function useSetExerciseHidden(locationId: string) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const key = placeKeys.devices(userId, locationId);
  return useMutation({
    mutationFn: async ({
      deviceId,
      exercise,
      hidden,
    }: {
      deviceId: string;
      exercise: ExerciseSummary;
      hidden: boolean;
    }) => {
      const { error } = hidden
        ? await supabase
            .from('device_hidden_exercises')
            .upsert({ device_id: deviceId, exercise_id: exercise.id }, { ignoreDuplicates: true })
        : await supabase
            .from('device_hidden_exercises')
            .delete()
            .eq('device_id', deviceId)
            .eq('exercise_id', exercise.id);
      if (error) throw error;
    },
    onMutate: async ({ deviceId, exercise, hidden }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DeviceWithExercises[]>(key);
      queryClient.setQueryData<DeviceWithExercises[]>(key, (devices) =>
        devices?.map((device) => {
          if (device.id !== deviceId) return device;
          const offered = device.exercises.filter((e) => e.id !== exercise.id);
          const notOffered = device.hiddenExercises.filter((e) => e.id !== exercise.id);
          return hidden
            ? { ...device, exercises: offered, hiddenExercises: [...notOffered, exercise] }
            : {
                ...device,
                exercises: [...offered, exercise].sort(byName),
                hiddenExercises: notOffered,
              };
        }),
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(key, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
