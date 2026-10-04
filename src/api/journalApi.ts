import type { SaveJournal } from '../models/journal';
import { STORAGE_KEYS } from '../constants/storageVersion';
import { loadLocal, saveLocal } from '../utils/storage';

export const journalApi = {
  list: () => loadLocal<SaveJournal[]>(STORAGE_KEYS.journals, []),
  saveList: (items: SaveJournal[]) => saveLocal(STORAGE_KEYS.journals, items),
  activeId: () => loadLocal<string>(STORAGE_KEYS.activeJournal, ''),
  saveActiveId: (id: string) => saveLocal(STORAGE_KEYS.activeJournal, id),

  append(journal: SaveJournal) {
    const items = this.list().filter((item) => item.id !== journal.id);
    items.push(journal);
    this.saveList(items);
    this.saveActiveId(journal.id);
  },
  byId(id: string) {
    return this.list().find((item) => item.id === id);
  },
  active(): SaveJournal | undefined {
    const id = this.activeId();
    return id ? this.byId(id) : undefined;
  },
  clearActive() {
    this.saveActiveId('');
  },
};
