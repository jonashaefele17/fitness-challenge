import type { Device, ExerciseMeasure, ExerciseSummary } from '../types';

/** PostgREST select for a device with its type. */
export const DEVICE_COLUMNS =
  'id, weight_step, device_types!inner(id, name, default_weight_step, comparable, setting_fields)';

const num = (value: number | string | null): number | null =>
  value === null ? null : Number(value);

export interface DeviceRow {
  id: string;
  weight_step: number | null;
  device_types: {
    id: string;
    name: string;
    default_weight_step: number | null;
    comparable: boolean;
    setting_fields: string[];
  };
}

export function toDevice(row: DeviceRow): Device {
  const typeStep = num(row.device_types.default_weight_step);
  return {
    id: row.id,
    typeId: row.device_types.id,
    name: row.device_types.name,
    weightStep: num(row.weight_step) ?? typeStep,
    typeWeightStep: typeStep,
    comparable: row.device_types.comparable,
    settingFields: row.device_types.setting_fields,
  };
}

export function toExercise(row: {
  id: string;
  name: string;
  measure: ExerciseMeasure;
}): ExerciseSummary {
  return { id: row.id, name: row.name, measure: row.measure };
}

export const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'de');
