import { useTripStore } from '../stores/tripStore';
import { useDayPlanStore } from '../stores/dayPlanStore';
import { useCatalogStore } from '../stores/catalogStore';
import { useCollabStore } from '../stores/collabStore';
import { useJournalStore } from '../stores/journalStore';
import { STORAGE_KEYS } from '../constants/storageVersion';

// 纯前端模拟「两个人先后保存」：开两个标签页，分别选同行人 A / B。
// storage 事件只在其它标签页写入时触发，本标签页自己的保存已在 store 内即时刷新。
const WATCHED_KEYS = new Set<string>([
  STORAGE_KEYS.trips,
  STORAGE_KEYS.dayPlans,
  STORAGE_KEYS.spots,
  STORAGE_KEYS.catalogVersions,
  STORAGE_KEYS.catalogLatest,
  STORAGE_KEYS.drafts,
  STORAGE_KEYS.conflicts,
  STORAGE_KEYS.journals,
  STORAGE_KEYS.activeJournal,
  STORAGE_KEYS.currentAuthor,
]);

export function useStorageSync() {
  function onStorage(event: StorageEvent) {
    if (!event.key || !WATCHED_KEYS.has(event.key)) return;
    // 其它标签页（另一个人）落盘后，本标签页全部读模型重新拉取，保证乐观锁看到最新 revision
    useTripStore().refresh();
    useDayPlanStore().refresh();
    useCatalogStore().refresh();
    useCollabStore().refresh();
    useJournalStore().refresh();
  }
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
