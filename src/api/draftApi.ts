import type { TripDraft } from '../models/draft';
import { STORAGE_KEYS } from '../constants/storageVersion';
import { loadLocal, saveLocal } from '../utils/storage';

export const draftApi = {
  list: () => loadLocal<TripDraft[]>(STORAGE_KEYS.drafts, []),
  save: (items: TripDraft[]) => saveLocal(STORAGE_KEYS.drafts, items),
};
