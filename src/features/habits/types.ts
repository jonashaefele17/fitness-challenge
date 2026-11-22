export type HabitInputType =
  'yes_no' | 'number' | 'duration' | 'time_pair' | 'choice' | 'checklist';
export type HabitFrequency = 'daily' | 'weekdays' | 'weekly';
export type HabitTimeOfDay = 'morning' | 'evening';
export type HabitSource = 'manual' | 'training' | 'external';

/** One condition of a rule: min/max/between a value, or before/after a time ("23:15"). */
export interface HabitCondition {
  op: 'min' | 'max' | 'between' | 'before' | 'after';
  value: number | string;
  value2?: number;
  /** Time pair: what the condition is about. */
  field?: 'duration' | 'start' | 'end';
}

export interface HabitOption {
  key: string;
  label: string;
  /** Choice: how far it meets the habit (1, 0.5, 0). */
  score?: number;
}

/** What a habit asks and how it is judged (a template or a version). */
export interface HabitDefinition {
  name: string;
  inputType: HabitInputType;
  unit: string | null;
  rule: HabitCondition[];
  frequency: HabitFrequency;
  /** ISO weekdays (1 = Monday) for "weekdays". */
  weekdays: number[];
  timesPerWeek: number | null;
  timeOfDay: HabitTimeOfDay;
  options: HabitOption[];
  source: HabitSource;
}

export interface HabitTemplate extends HabitDefinition {
  id: string;
  key: string | null;
  description: string | null;
}

export interface Habit {
  id: string;
  templateId: string | null;
  archived: boolean;
  /** The definition valid today. */
  current: HabitDefinition;
  /** The day it began. */
  since: string;
}

/** An entry's value, by input type. */
export type HabitValue =
  | { done: boolean }
  | { value: number }
  | { minutes: number }
  | { start: string; end: string }
  | { choice: string }
  | { checked: string[] };

export type HabitDayState = 'done' | 'partial' | 'missed' | 'open' | 'paused';

/** How a habit stands on one day. */
export interface HabitDay {
  habitId: string;
  onDate: string;
  name: string;
  inputType: HabitInputType;
  frequency: HabitFrequency;
  source: HabitSource;
  timeOfDay: HabitTimeOfDay;
  due: boolean;
  paused: boolean;
  value: HabitValue | null;
  /** null: weekly habits, judged per week */
  state: HabitDayState | null;
}

/** A weekly habit in one week. */
export interface HabitWeek {
  habitId: string;
  weekStart: string;
  doneDays: number;
  target: number;
  state: 'done' | 'open' | 'missed' | 'paused';
}

export interface HabitPause {
  id: string;
  fromDate: string;
  toDate: string;
  note: string | null;
}
