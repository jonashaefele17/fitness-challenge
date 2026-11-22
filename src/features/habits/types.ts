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
  /** Checklist: remind me at this time ("08:00") if not ticked yet. */
  remindAt?: string;
}

/** When to be reminded of the check-in ("21:00"), or null for not. */
export interface HabitReminders {
  morningAt: string | null;
  eveningAt: string | null;
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

/** Who sees a habit: only me · whether it was met · also the values. */
export type ShareLevel = 'private' | 'done' | 'values';

export interface Habit {
  id: string;
  templateId: string | null;
  archived: boolean;
  shareLevel: ShareLevel;
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

/** A habit's figures: quota in a range, streaks over its whole life. */
export interface HabitStats {
  habitId: string;
  /** Streaks count days (daily habits) or weeks (weekly ones). */
  unit: 'days' | 'weeks';
  counted: number;
  met: number;
  /** 0 … 1; null when nothing counted yet. */
  quota: number | null;
  currentStreak: number;
  bestStreak: number;
}

/** A habit's figures in a range, in plain words. */
export interface HabitSummary {
  habitId: string;
  /** Days (or weeks) counted and met. */
  counted: number;
  met: number;
  quota: number | null;
  /** The same share for the range before (trend). */
  previousQuota: number | null;
  /** Numbers and durations (minutes). */
  avgValue: number | null;
  bestValue: number | null;
  /** Sleep: minutes after midnight. */
  avgStart: number | null;
  avgEnd: number | null;
  avgDuration: number | null;
  choiceCounts: Record<string, number>;
  itemCounts: Record<string, number>;
  completeDays: number;
}
