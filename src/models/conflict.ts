export type ConflictReason = 'concurrent' | 'confirmed-protected';
export type ConflictStatus = 'pending' | 'resolved';
export type ConflictResolution = 'keep-mine' | 'take-theirs';

export interface SaveConflict {
  id: string;
  trip_id: string;
  day_index: number;
  date: string;
  editor: string;
  reason: ConflictReason;
  status: ConflictStatus;
  local_revision: number;
  remote_revision: number;
  created_at: string;
  resolved_at?: string;
  resolution?: ConflictResolution;
}
