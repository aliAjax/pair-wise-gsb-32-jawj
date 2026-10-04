import { defineStore } from 'pinia';
import type { Spot } from '../models/spot';
import type { CatalogVersion } from '../models/catalogVersion';
import { SpotCategory } from '../constants/spot';
import { spotApi, seedSpots } from '../api/spotApi';
import { catalogApi, buildVersion } from '../api/catalogApi';
import { createCatalogJournal } from '../utils/journalRunner';
import { messages } from '../constants/messages';
import { toast } from '../utils/message';
import { JournalStatus } from '../constants/catalog';
import type { CatalogRevisionPayload } from '../models/journal';

export const useCatalogStore = defineStore('catalog', {
  state: () => {
    const spots = spotApi.list();
    const versions = catalogApi.ensureSeeded(spots);
    return {
      spots,
      versions,
      latestVersion: catalogApi.latestVersion(),
      // 目录改版进行中（存在中断日志）时，spots 仍是旧版，恢复后才跳到新版
      revising: false,
    };
  },
  getters: {
    spotById: (state) => (id: string) => state.spots.find((spot) => spot.id === id),
  },
  actions: {
    refresh() {
      this.spots = spotApi.list();
      this.versions = catalogApi.versions();
      this.latestVersion = catalogApi.latestVersion();
    },

    // 发布目录新版本（调价 / 改分类）。整次改版走 WAL 多步保存，写一半失败可恢复。
    amendSpot(id: string, patch: { price?: number; category?: SpotCategory }) {
      const next: Spot[] = this.spots.map((spot) => (spot.id === id ? { ...spot, ...patch } : spot));
      const before = this.spots.find((spot) => spot.id === id);
      const version = this.latestVersion + 1;
      const changes: string[] = [];
      if (patch.price !== undefined && before && patch.price !== before.price) {
        changes.push(`${before.name} 调价 ${before.price} → ${patch.price}`);
      }
      if (patch.category && before && patch.category !== before.category) {
        changes.push(`${before.name} 改分类 ${before.category} → ${patch.category}`);
      }
      const note = changes.join('；') || '目录微调';
      const payload: CatalogRevisionPayload = {
        version,
        note,
        spots: next,
        removed_spot_ids: [],
        snapshot: buildVersion(version, note, next),
      };
      const journal = createCatalogJournal(payload);
      this.refresh();
      if (journal.status === JournalStatus.DONE) toast.ok(messages.catalogAmended);
      return journal;
    },

    // 替换景点：新景点顶掉旧 spot_id；未确认行程里的旧引用在 PURGE_REFS 步被清掉，
    // 已确认安排靠 frozen 快照继续可读、可计价。
    replaceSpot(oldId: string, replacement: Spot) {
      const next: Spot[] = this.spots.filter((spot) => spot.id !== oldId);
      if (!next.some((spot) => spot.id === replacement.id)) next.push(replacement);
      const version = this.latestVersion + 1;
      const old = this.spots.find((spot) => spot.id === oldId);
      const note = `替换景点：${old?.name || oldId} → ${replacement.name}`;
      const payload: CatalogRevisionPayload = {
        version,
        note,
        spots: next,
        removed_spot_ids: [oldId],
        snapshot: buildVersion(version, note, next),
      };
      const journal = createCatalogJournal(payload);
      this.refresh();
      if (journal.status === JournalStatus.DONE) toast.ok(messages.catalogReplace);
      return journal;
    },
  },
});

export { seedSpots };
