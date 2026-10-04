import type { SaveConflict } from '../models/conflict';
import { STORAGE_KEYS } from '../constants/storageVersion';
import { loadLocal, saveLocal } from '../utils/storage';

export const conflictApi = {
  list: () => loadLocal<SaveConflict[]>(STORAGE_KEYS.conflicts, []),
  save: (items: SaveConflict[]) => saveLocal(STORAGE_KEYS.conflicts, items),
};
