import type { SpotSnapshot } from './spot';

export type TransportMode = 'walk' | 'metro' | 'taxi' | 'train';

export interface DayPlanItem {
  id: string;
  spot_id: string;
  start_time: string;
  end_time: string;
  note: string;
  transport: TransportMode;
  snapshot?: SpotSnapshot;
}

export interface DayPlan {
  id: string;
  trip_id: string;
  day_index: number;
  date: string;
  items: DayPlanItem[];
  revision: number;
  updated_at: string;
  confirmed_at?: string;
  confirmed_by?: string;
  confirmed_catalog_version?: number;
}
