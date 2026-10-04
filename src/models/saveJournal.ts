import type { DayPlan } from './dayPlan';
import type { DraftRef } from '../types';
import type { SaveConflict } from './conflict';
import type { Trip } from './trip';
import type { TripDraft } from './draft';

export type SaveStepStatus = 'pending' | 'completed';

export interface SaveStep {
  key: string;
  label: string;
  status: SaveStepStatus;
}

export interface SaveJournal {
  id: string;
  trip_id: string;
  editor: string;
  steps: SaveStep[];
  createdAt: string;
  failedAt?: string;
  failedAfterStep?: string;
  desired: {
    trips: Trip[];
    dayPlans: DayPlan[];
    conflicts: SaveConflict[];
    draft: TripDraft;
  };
  draftRef: DraftRef;
}
