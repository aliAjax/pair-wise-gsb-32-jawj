import type { SaveJournal } from '../models/saveJournal';
import { STORAGE_KEYS } from '../constants/storageVersion';
import { loadLocal, saveLocal } from '../utils/storage';

export const saveJournalApi = {
  list: () => loadLocal<SaveJournal[]>(STORAGE_KEYS.saveJournals, []),
  save: (items: SaveJournal[]) => saveLocal(STORAGE_KEYS.saveJournals, items),
};
