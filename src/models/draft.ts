import type { DayPlan } from './dayPlan';

export interface TripDraft {
  id: string;
  trip_id: string;
  editor: string;
  base_revision: number;
  base_days: DayPlan[];
  days: DayPlan[];
  catalog_version: number;
  forced_day_indexes: number[];
  created_at: string;
  updated_at: string;
}
