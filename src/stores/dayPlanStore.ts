import { defineStore } from 'pinia';
import type { DayPlan, DayPlanItem } from '../models/dayPlan';
import { dayPlanApi } from '../api/dayPlanApi';
import { tripApi } from '../api/tripApi';
import { messages } from '../constants/messages';
import { toast } from '../utils/message';
import { useCatalogStore } from './catalogStore';
import { useCollabStore } from './collabStore';
import { useJournalStore } from './journalStore';
import { createSavePlanJournal } from '../utils/journalRunner';
import { JournalStatus } from '../constants/catalog';
import type { SavePlanPayload } from '../models/journal';

export const useDayPlanStore = defineStore('dayPlan', {
  state: () => ({ dayPlans: dayPlanApi.list() as DayPlan[] }),
  actions: {
    refresh() {
      this.dayPlans = dayPlanApi.list();
    },
    ensureDay(tripId: string, dayIndex = 1, date = new Date().toISOString().slice(0, 10)) {
      let day = this.dayPlans.find((item) => item.trip_id === tripId && item.day_index === dayIndex);
      if (!day) {
        day = { id: crypto.randomUUID(), trip_id: tripId, day_index: dayIndex, date, items: [] };
        this.dayPlans.push(day);
      }
      return day;
    },
    // 已确认的天不允许再编辑
    isConfirmed(tripId: string, dayIndex: number) {
      return Boolean(this.dayPlans.find((day) => day.trip_id === tripId && day.day_index === dayIndex)?.confirmed_version);
    },

    // 加景点只改内存里的未确认草稿，价格跟随目录最新版；不立即落盘，
    // 真正持久化统一走 saveDays 的多步事务，保证两个人先后保存时乐观锁有效。
    addSpot(tripId: string, spotId: string, dayIndex = 1) {
      const day = this.ensureDay(tripId, dayIndex);
      const item: DayPlanItem = { spot_id: spotId, start_time: '10:00', end_time: '12:00', note: '现场调整', transport: 'metro' };
      day.items.push(item);
      toast.ok(messages.spotAdded);
    },
    removeSpot(tripId: string, dayIndex: number, spotId: string) {
      const day = this.ensureDay(tripId, dayIndex);
      day.items = day.items.filter((item) => item.spot_id !== spotId);
    },
    reorder(tripId: string, dayIndex: number, from: number, to: number) {
      const day = this.ensureDay(tripId, dayIndex);
      const [moved] = day.items.splice(from, 1);
      if (moved) day.items.splice(to, 0, moved);
    },

    // 两人先后保存的统一入口：走「校验版本 → 保护已确认 → 暂存草稿 → 写行程 → 提交版本号」的完整步骤
    saveDays(tripId: string, days: DayPlan[], options: { confirm?: boolean; baseRevision?: number } = {}) {
      const catalogStore = useCatalogStore();
      const collabStore = useCollabStore();
      const journalStore = useJournalStore();
      const payload: SavePlanPayload = {
        trip_id: tripId,
        author: collabStore.author,
        base_revision: options.baseRevision ?? this.tripRevision(tripId),
        days: JSON.parse(JSON.stringify(days)) as DayPlan[],
        confirm: Boolean(options.confirm),
        catalog_version: catalogStore.latestVersion,
      };
      const journal = createSavePlanJournal(payload);
      this.refresh();
      journalStore.refresh();
      if (journal.status === JournalStatus.CONFLICT) toast.fail(messages.conflictFound);
      else if (journal.status === JournalStatus.DONE && options.confirm) {
        toast.ok(messages.dayConfirmed.replace('{version}', String(catalogStore.latestVersion)));
      }
      return journal;
    },

    // 确认当天行程：固定当时目录的价格和分类
    confirmDay(tripId: string, dayIndex: number) {
      const day = this.dayPlans.find((item) => item.trip_id === tripId && item.day_index === dayIndex);
      if (!day) return;
      return this.saveDays(tripId, [day], { confirm: true });
    },

    tripRevision(tripId: string) {
      return tripApi.list().find((trip) => trip.id === tripId)?.revision ?? 0;
    },
  },
});
