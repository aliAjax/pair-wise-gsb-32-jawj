import type { DayPlan } from '../models/dayPlan';
import type { PlanConflict } from '../models/conflict';
import { STORAGE_KEYS } from '../constants/storageVersion';
import { loadLocal, saveLocal } from '../utils/storage';

// 草稿按 计划 + 天 + 作者 维度保存，后到者的草稿不会被任何人覆盖。
export interface TripDraft {
  trip_id: string;
  day_index: number;
  author: string;
  day: DayPlan;
  base_revision: number;
  updated_at: string;
}

export const collabApi = {
  drafts: () => loadLocal<TripDraft[]>(STORAGE_KEYS.drafts, []),
  saveDrafts: (items: TripDraft[]) => saveLocal(STORAGE_KEYS.drafts, items),

  conflicts: () => loadLocal<PlanConflict[]>(STORAGE_KEYS.conflicts, []),
  saveConflicts: (items: PlanConflict[]) => saveLocal(STORAGE_KEYS.conflicts, items),

  author: () => loadLocal<string>(STORAGE_KEYS.currentAuthor, '同行人 A'),
  saveAuthor: (author: string) => saveLocal(STORAGE_KEYS.currentAuthor, author),

  upsertDraft(draft: TripDraft): TripDraft[] {
    const items = this.drafts().filter(
      (item) => !(item.trip_id === draft.trip_id && item.day_index === draft.day_index && item.author === draft.author),
    );
    items.push(draft);
    this.saveDrafts(items);
    return items;
  },
};
