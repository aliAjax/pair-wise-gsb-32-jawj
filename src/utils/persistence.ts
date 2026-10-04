import type { DayPlan } from '../models/dayPlan';
import type { SaveConflict } from '../models/conflict';
import type { Trip } from '../models/trip';
import type { TripDraft } from '../models/draft';
import { cloneData } from './catalog';

function serializeDay(day?: DayPlan) {
  return JSON.stringify(day ? {
    date: day.date,
    items: day.items.map((item) => ({
      spot_id: item.spot_id,
      start_time: item.start_time,
      end_time: item.end_time,
      note: item.note,
      transport: item.transport,
    })),
  } : null);
}

export interface DraftSaveAnalysis {
  blocked: boolean;
  trip?: Trip;
  nextTrip?: Trip;
  appliedDays: DayPlan[];
  nextDayPlans: DayPlan[];
  nextConflicts: SaveConflict[];
  nextDraft: TripDraft;
  conflicts: SaveConflict[];
}

export function analyzeDraftSave(input: {
  trips: Trip[];
  dayPlans: DayPlan[];
  conflicts: SaveConflict[];
  draft: TripDraft;
  forcedDayIndexes: number[];
}): DraftSaveAnalysis {
  const { trips, dayPlans, conflicts, draft, forcedDayIndexes } = input;
  const now = new Date().toISOString();
  const trip = trips.find((item) => item.id === draft.trip_id);
  const nextDayPlans = cloneData(dayPlans);
  const nextConflicts = conflicts
    .filter((conflict) => conflict.trip_id !== draft.trip_id || conflict.status !== 'resolved')
    .map((conflict) => cloneData(conflict));
  const generatedConflicts: SaveConflict[] = [];

  if (!trip) {
    return {
      blocked: true,
      appliedDays: [],
      nextDayPlans,
      nextConflicts,
      nextDraft: cloneData(draft),
      conflicts: [],
    };
  }

  const appliedDays: DayPlan[] = [];
  let appliedAny = false;

  for (const localDayInput of draft.days) {
    const localDay = cloneData(localDayInput);
    const baseDay = draft.base_days.find((day) => day.day_index === localDay.day_index);
    const remoteIndex = nextDayPlans.findIndex((day) => day.trip_id === draft.trip_id && day.day_index === localDay.day_index);
    const remoteDay = remoteIndex >= 0 ? nextDayPlans[remoteIndex] : undefined;
    const localChanged = serializeDay(baseDay) !== serializeDay(localDay);
    const remoteChanged = serializeDay(baseDay) !== serializeDay(remoteDay);
    const existing = nextConflicts.find((conflict) => (
      conflict.trip_id === draft.trip_id
      && conflict.day_index === localDay.day_index
      && conflict.editor === draft.editor
      && conflict.status === 'pending'
    ));
    const forced = forcedDayIndexes.includes(localDay.day_index);
    const protectedConflict = Boolean(remoteDay?.confirmed_at && localChanged);
    const concurrentConflict = localChanged && remoteChanged;

    if (protectedConflict) {
      const conflict: SaveConflict = existing ? {
        ...existing,
        reason: 'confirmed-protected',
        local_revision: draft.base_revision,
        remote_revision: trip.revision,
      } : {
        id: crypto.randomUUID(),
        trip_id: draft.trip_id,
        day_index: localDay.day_index,
        date: remoteDay?.date || localDay.date,
        editor: draft.editor,
        reason: 'confirmed-protected',
        status: 'pending',
        local_revision: draft.base_revision,
        remote_revision: trip.revision,
        created_at: now,
      };
      if (!existing) nextConflicts.push(conflict);
      generatedConflicts.push(conflict);
      if (remoteDay) appliedDays.push(cloneData(remoteDay));
      continue;
    }

    if (concurrentConflict && !forced) {
      const conflict: SaveConflict = existing ? {
        ...existing,
        reason: 'concurrent',
        local_revision: draft.base_revision,
        remote_revision: trip.revision,
      } : {
        id: crypto.randomUUID(),
        trip_id: draft.trip_id,
        day_index: localDay.day_index,
        date: remoteDay?.date || localDay.date,
        editor: draft.editor,
        reason: 'concurrent',
        status: 'pending',
        local_revision: draft.base_revision,
        remote_revision: trip.revision,
        created_at: now,
      };
      if (!existing) nextConflicts.push(conflict);
      generatedConflicts.push(conflict);
      if (remoteDay) appliedDays.push(cloneData(remoteDay));
      continue;
    }

    if (localChanged || forced) {
      const appliedDay: DayPlan = {
        ...localDay,
        trip_id: draft.trip_id,
        revision: Math.max(remoteDay?.revision || 0, localDay.revision || 0, baseDay?.revision || 0) + 1,
        updated_at: now,
      };
      if (remoteIndex >= 0) nextDayPlans.splice(remoteIndex, 1, appliedDay);
      else nextDayPlans.push(appliedDay);
      appliedDays.push(cloneData(appliedDay));
      appliedAny = true;
      if (existing) {
        Object.assign(existing, {
          status: 'resolved' as const,
          resolution: 'keep-mine' as const,
          resolved_at: now,
        });
      }
    } else if (remoteDay) {
      appliedDays.push(cloneData(remoteDay));
    }
  }

  const pending = nextConflicts.filter((conflict) => conflict.trip_id === draft.trip_id && conflict.status === 'pending');
  const nextTrip = appliedAny
    ? { ...trip, revision: Math.max(trip.revision, draft.base_revision) + 1 }
    : trip;
  const resolvedDays = draft.days.map((localDay) => {
    const hasPending = pending.some((conflict) => conflict.day_index === localDay.day_index);
    const committed = appliedDays.find((day) => day.day_index === localDay.day_index);
    return cloneData(hasPending || !committed ? localDay : committed);
  });
  const nextDraft: TripDraft = {
    ...cloneData(draft),
    base_days: cloneData(resolvedDays),
    days: cloneData(resolvedDays),
    base_revision: nextTrip.revision,
    forced_day_indexes: pending.length ? draft.forced_day_indexes : [],
    updated_at: now,
  };

  return {
    blocked: pending.length > 0,
    trip,
    nextTrip,
    appliedDays,
    nextDayPlans,
    nextConflicts,
    nextDraft,
    conflicts: generatedConflicts,
  };
}

export function replaceTripInList(trips: Trip[], nextTrip: Trip) {
  return trips.map((trip) => trip.id === nextTrip.id ? nextTrip : trip);
}
