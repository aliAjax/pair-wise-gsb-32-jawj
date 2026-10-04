import { defineStore } from 'pinia';
import type { DayPlan, DayPlanItem, TransportMode } from '../models/dayPlan';
import type { SaveConflict, ConflictResolution } from '../models/conflict';
import type { SaveJournal, SaveStep } from '../models/saveJournal';
import type { TripDraft } from '../models/draft';
import { dayPlanApi } from '../api/dayPlanApi';
import { conflictApi } from '../api/conflictApi';
import { draftApi } from '../api/draftApi';
import { saveJournalApi } from '../api/saveJournalApi';
import { tripApi } from '../api/tripApi';
import { useCatalogStore } from './catalogStore';
import { useTripStore } from './tripStore';
import { messages } from '../constants/messages';
import { toast } from '../utils/message';
import { armStorageFailureOnce, clearStorageFailure } from '../utils/storage';
import { attachConfirmationSnapshots, cloneData, createSpotSnapshot, replaceItemSpot } from '../utils/catalog';
import { analyzeDraftSave } from '../utils/persistence';

function normalizeDay(day: DayPlan): DayPlan {
  const fallbackDate = day.date ? new Date(day.date).toISOString() : new Date().toISOString();
  return {
    ...day,
    revision: day.revision || 0,
    updated_at: day.updated_at || fallbackDate,
    items: (day.items || []).map((item) => ({
      ...item,
      id: item.id || nowId(),
    })),
  };
}

function nowId() {
  return crypto.randomUUID();
}

export const useDayPlanStore = defineStore('dayPlan', {
  state: () => ({
    dayPlans: dayPlanApi.list().map(normalizeDay) as DayPlan[],
    drafts: draftApi.list() as TripDraft[],
    conflicts: conflictApi.list() as SaveConflict[],
    saveJournals: saveJournalApi.list() as SaveJournal[],
    lastRecoveryCount: 0,
  }),
  getters: {
    pendingConflicts: (state) => (tripId: string) => state.conflicts
      .filter((conflict) => conflict.trip_id === tripId && conflict.status === 'pending'),
    conflictDays: (state) => (tripId: string) => Array.from(new Set(state
      .conflicts
      .filter((conflict) => conflict.trip_id === tripId && conflict.status === 'pending')
      .map((conflict) => conflict.day_index))),
  },
  actions: {
    persistDayPlans() {
      dayPlanApi.save(this.dayPlans);
    },
    persistDrafts() {
      draftApi.save(this.drafts);
    },
    persistConflicts() {
      conflictApi.save(this.conflicts);
    },
    persistJournals() {
      saveJournalApi.save(this.saveJournals);
    },
    tripDays(tripId: string) {
      return this.dayPlans.filter((day) => day.trip_id === tripId);
    },
    refreshLatest() {
      this.dayPlans = dayPlanApi.list().map(normalizeDay);
      this.drafts = draftApi.list();
      this.conflicts = conflictApi.list();
      this.saveJournals = saveJournalApi.list();
      useTripStore().reload(tripApi.list());
    },
    touchTrip(tripId: string) {
      useTripStore().bumpRevision(tripId);
    },
    ensureDay(tripId: string, dayIndex = 1, date = new Date().toISOString().slice(0, 10)): DayPlan {
      let day = this.dayPlans.find((item) => item.trip_id === tripId && item.day_index === dayIndex);
      if (!day) {
        day = {
          id: nowId(),
          trip_id: tripId,
          day_index: dayIndex,
          date,
          items: [],
          revision: 1,
          updated_at: new Date().toISOString(),
        };
        this.dayPlans.push(day);
      }
      return day;
    },
    addSpot(tripId: string, spotId: string, dayIndex = 1) {
      const day = this.ensureDay(tripId, dayIndex);
      if (day.confirmed_at) {
        toast.warn(messages.dayAlreadyConfirmed);
        return;
      }
      const item: DayPlanItem = { id: nowId(), spot_id: spotId, start_time: '10:00', end_time: '12:00', note: '现场调整', transport: 'metro' };
      day.items.push(item);
      day.revision += 1;
      day.updated_at = new Date().toISOString();
      this.persistDayPlans();
      this.touchTrip(tripId);
      toast.ok(messages.spotAdded);
    },
    reorder(tripId: string, dayIndex: number, from: number, to: number) {
      const day = this.ensureDay(tripId, dayIndex);
      if (day.confirmed_at) {
        toast.warn(messages.dayAlreadyConfirmed);
        return;
      }
      const [moved] = day.items.splice(from, 1);
      if (moved) day.items.splice(to, 0, moved);
      day.revision += 1;
      day.updated_at = new Date().toISOString();
      this.persistDayPlans();
      this.touchTrip(tripId);
    },
    confirmDay(tripId: string, dayIndex: number) {
      const day = this.ensureDay(tripId, dayIndex);
      if (day.confirmed_at) {
        toast.warn(messages.dayAlreadyConfirmed);
        return;
      }
      const catalogStore = useCatalogStore();
      const missingSpot = day.items.some((item) => !catalogStore.spots.some((spot) => spot.id === item.spot_id));
      if (missingSpot) {
        toast.warn(messages.unknownSpotCannotConfirm);
        return;
      }
      const confirmed = attachConfirmationSnapshots(day, catalogStore.spots, catalogStore.currentVersion);
      const index = this.dayPlans.findIndex((item) => item.id === day.id);
      const timestamp = new Date().toISOString();
      const nextDay: DayPlan = {
        ...confirmed,
        confirmed_at: timestamp,
        confirmed_by: '当前用户',
        confirmed_catalog_version: catalogStore.currentVersion,
        revision: day.revision + 1,
        updated_at: timestamp,
      };
      this.dayPlans.splice(index, 1, nextDay);
      this.persistDayPlans();
      this.touchTrip(tripId);
      toast.ok(messages.dayConfirmed);
    },
    getDraft(tripId: string, editor: string) {
      return this.drafts.find((draft) => draft.trip_id === tripId && draft.editor === editor);
    },
    loadDraft(tripId: string, editor: string) {
      const existing = this.getDraft(tripId, editor);
      if (existing) return existing;
      const catalogStore = useCatalogStore();
      const days = cloneData(this.tripDays(tripId));
      const timestamp = new Date().toISOString();
      const trip = useTripStore().trips.find((item) => item.id === tripId);
      const draft: TripDraft = {
        id: nowId(),
        trip_id: tripId,
        editor,
        base_revision: trip?.revision || 1,
        base_days: cloneData(days),
        days,
        catalog_version: catalogStore.currentVersion,
        forced_day_indexes: [],
        created_at: timestamp,
        updated_at: timestamp,
      };
      this.drafts.push(draft);
      this.persistDrafts();
      toast.ok(messages.draftLoaded);
      return draft;
    },
    discardDraft(tripId: string, editor: string) {
      this.drafts = this.drafts.filter((draft) => !(draft.trip_id === tripId && draft.editor === editor));
      this.persistDrafts();
      toast.ok(messages.draftDiscarded);
    },
    addSpotToDraft(tripId: string, editor: string, spotId: string, dayIndex: number, start?: DayPlan) {
      const draft = this.loadDraft(tripId, editor);
      let day = draft.days.find((item) => item.day_index === dayIndex);
      if (!day) {
        const template = start || this.ensureDay(tripId, dayIndex);
        day = {
          ...cloneData(template),
          id: nowId(),
          items: [],
          revision: 1,
          updated_at: new Date().toISOString(),
          confirmed_at: undefined,
          confirmed_by: undefined,
          confirmed_catalog_version: undefined,
        };
        draft.days.push(day);
      }
      if (day.confirmed_at) {
        toast.warn(messages.dayAlreadyConfirmed);
        return;
      }
      day.items.push({ id: nowId(), spot_id: spotId, start_time: '10:00', end_time: '12:00', note: '草稿调整', transport: 'metro' });
      day.revision += 1;
      day.updated_at = new Date().toISOString();
      draft.updated_at = new Date().toISOString();
      this.persistDrafts();
      toast.ok(messages.spotAdded);
    },
    reorderDraft(tripId: string, editor: string, dayIndex: number, from: number, to: number) {
      const draft = this.loadDraft(tripId, editor);
      const day = draft.days.find((item) => item.day_index === dayIndex);
      if (!day || day.confirmed_at) return;
      const [moved] = day.items.splice(from, 1);
      if (moved) day.items.splice(to, 0, moved);
      day.updated_at = new Date().toISOString();
      draft.updated_at = new Date().toISOString();
      this.persistDrafts();
    },
    replaceSpotInDraft(tripId: string, editor: string, dayIndex: number, itemIndex: number, nextSpotId: string) {
      const draft = this.loadDraft(tripId, editor);
      const targetDay = draft.days.find((day) => day.day_index === dayIndex);
      const target = targetDay?.items[itemIndex];
      if (!targetDay || !target || targetDay.confirmed_at) {
        toast.warn(messages.dayAlreadyConfirmed);
        return;
      }
      const oldSpotId = target.spot_id;
      draft.days = draft.days.map((day) => {
        if (day.confirmed_at) return day;
        if (day.day_index === dayIndex) {
          const replacement = replaceItemSpot({ ...target }, nextSpotId);
          const withoutOld = day.items.filter((item) => item.id !== target.id);
          withoutOld.splice(Math.min(itemIndex, withoutOld.length), 0, replacement);
          return { ...day, items: withoutOld };
        }
        return { ...day, items: day.items.filter((item) => item.spot_id !== oldSpotId) };
      });
      draft.updated_at = new Date().toISOString();
      this.persistDrafts();
      useCatalogStore().replaceSpotReference(oldSpotId, nextSpotId);
      this.dayPlans = dayPlanApi.list().map(normalizeDay);
      this.drafts = draftApi.list();
    },
    async saveDraft(tripId: string, editor: string, failAfterStep?: SaveStep['key']) {
      this.persistDrafts();
      this.refreshLatest();
      const existingDraft = this.getDraft(tripId, editor) || this.loadDraft(tripId, editor);
      const tripStore = useTripStore();
      const analysis = analyzeDraftSave({
        trips: tripStore.trips,
        dayPlans: this.dayPlans,
        conflicts: this.conflicts,
        draft: existingDraft,
        forcedDayIndexes: existingDraft.forced_day_indexes,
      });
      if (!analysis.trip) return analysis;

      const desired = {
        trips: tripStore.trips.map((trip) => trip.id === analysis.trip!.id ? analysis.nextTrip! : trip),
        dayPlans: analysis.nextDayPlans,
        conflicts: analysis.nextConflicts,
        draft: analysis.nextDraft,
      };
      const steps: SaveStep[] = [
        { key: 'days', label: '写入每日安排', status: 'pending' },
        { key: 'conflicts', label: '登记冲突日期', status: 'pending' },
        { key: 'trips', label: '推进计划版本', status: 'pending' },
        { key: 'drafts', label: '保存个人草稿', status: 'pending' },
      ];
      const journal: SaveJournal = {
        id: nowId(),
        trip_id: tripId,
        editor,
        steps,
        createdAt: new Date().toISOString(),
        desired,
        draftRef: { key: `${tripId}:${editor}`, tripId, editor },
      };
      this.saveJournals = this.saveJournals
        .filter((item) => !(item.trip_id === tripId && item.editor === editor))
        .concat(journal);
      clearStorageFailure();
      saveJournalApi.save(this.saveJournals);

      try {
        for (let index = 0; index < steps.length; index += 1) {
          const step = steps[index];
          if (failAfterStep && index > 0 && steps[index - 1].key === failAfterStep) armStorageFailureOnce();
          if (step.key === 'days') dayPlanApi.save(desired.dayPlans);
          if (step.key === 'conflicts') conflictApi.save(desired.conflicts);
          if (step.key === 'trips') {
            tripApi.save(desired.trips);
          }
          if (step.key === 'drafts') draftApi.save([
            ...this.drafts.filter((draft) => !(draft.trip_id === tripId && draft.editor === editor)),
            desired.draft,
          ]);
          step.status = 'completed';
          saveJournalApi.save(this.saveJournals);
        }
      } catch (error) {
        journal.failedAt = new Date().toISOString();
        journal.failedAfterStep = steps.filter((step) => step.status === 'completed').slice(-1)[0]?.key;
        this.recoverInterruptedSaves();
        tripStore.reload(tripApi.list());
        throw error;
      }

      this.dayPlans = desired.dayPlans;
      this.conflicts = desired.conflicts;
      this.drafts = this.drafts
        .filter((draft) => !(draft.trip_id === tripId && draft.editor === editor))
        .concat(desired.draft);
      tripStore.reload(desired.trips);
      this.saveJournals = this.saveJournals.filter((item) => item.id !== journal.id);
      this.persistJournals();
      if (analysis.blocked) toast.warn(messages.conflictDetected);
      else toast.ok(messages.draftApplied);
      return analysis;
    },
    resolveConflict(conflictId: string, resolution: ConflictResolution) {
      const conflict = this.conflicts.find((item) => item.id === conflictId);
      const draft = conflict ? this.getDraft(conflict.trip_id, conflict.editor) : undefined;
      if (!conflict || !draft) return;
      if (conflict.reason === 'confirmed-protected' && resolution === 'keep-mine') {
        toast.warn(messages.confirmedProtected);
        return;
      }
      conflict.status = 'resolved';
      conflict.resolution = resolution;
      conflict.resolved_at = new Date().toISOString();
      if (resolution === 'keep-mine') draft.forced_day_indexes = Array.from(new Set(draft.forced_day_indexes.concat(conflict.day_index)));
      if (resolution === 'take-theirs') {
        const remoteDay = this.dayPlans.find((day) => day.trip_id === conflict.trip_id && day.day_index === conflict.day_index);
        draft.days = draft.days
          .filter((day) => day.day_index !== conflict.day_index)
          .concat(remoteDay ? cloneData(remoteDay) : []);
        draft.forced_day_indexes = draft.forced_day_indexes.filter((dayIndex) => dayIndex !== conflict.day_index);
      }
      draft.updated_at = new Date().toISOString();
      this.persistConflicts();
      this.persistDrafts();
      toast.ok(resolution === 'keep-mine' ? messages.conflictKept : messages.conflictTaken);
    },
    recoverInterruptedSaves() {
      const journals = saveJournalApi.list();
      if (!journals.length) {
        this.lastRecoveryCount = 0;
        return 0;
      }
      for (const journal of journals) {
        dayPlanApi.save(journal.desired.dayPlans);
        conflictApi.save(journal.desired.conflicts);
        tripApi.save(journal.desired.trips);
        draftApi.save([
          ...draftApi.list().filter((draft) => !(draft.trip_id === journal.trip_id && draft.editor === journal.editor)),
          journal.desired.draft,
        ]);
      }
      const remaining = saveJournalApi.list().filter((journal) => !journals.some((done) => done.id === journal.id));
      saveJournalApi.save(remaining);
      this.dayPlans = dayPlanApi.list().map(normalizeDay);
      this.conflicts = conflictApi.list();
      this.drafts = draftApi.list();
      this.saveJournals = remaining;
      this.lastRecoveryCount = journals.length;
      return journals.length;
    },
    addConfirmedSnapshotForTest(tripId: string, dayIndex: number, itemIndex: number) {
      const day = this.ensureDay(tripId, dayIndex);
      const item = day.items[itemIndex];
      const catalogStore = useCatalogStore();
      const spot = catalogStore.spots.find((entry) => entry.id === item?.spot_id);
      if (item && spot) item.snapshot = createSpotSnapshot(spot, catalogStore.currentVersion);
    },
  },
});
