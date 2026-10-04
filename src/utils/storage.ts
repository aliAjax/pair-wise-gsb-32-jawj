import Dexie, { type Table } from 'dexie';
import { STORAGE_VERSION } from '../constants/storageVersion';
import { messages } from '../constants/messages';

class TripWeaverDb extends Dexie {
  trips!: Table<unknown, string>;
  spots!: Table<unknown, string>;
  dayPlans!: Table<unknown, string>;
  // 目录版本快照只追加，后续可从 IndexedDB 读出任意历史版本
  catalogVersions!: Table<unknown, number>;
  saveJournals!: Table<unknown, string>;
  constructor() {
    super('tripweaver');
    this.version(1).stores({ trips: 'id,status,destination', spots: 'id,category', dayPlans: 'id,trip_id,day_index' });
    this.version(2).stores({
      trips: 'id,status,destination,revision',
      spots: 'id,category,version',
      dayPlans: 'id,trip_id,day_index,confirmed_version',
      catalogVersions: 'version,created_at',
      saveJournals: 'id,kind,status,created_at',
    });
  }
}

export const db = new TripWeaverDb();

// 故障注入：设为 true 后，下一次持久化会在「写入中途」抛错，
// 用于演示「保存写到一半失败后能从完整步骤恢复」。
// key 形如 STORAGE_KEYS.dayPlans，命中才失败，从而精确让多步保存停在中间一步。
export const faultInject = {
  armedKey: '' as string,
  consumeOnce: true,
  arm(key = '', consumeOnce = true) {
    this.armedKey = key;
    this.consumeOnce = consumeOnce;
  },
  disarm() {
    this.armedKey = '';
  },
  isArmedFor(key: string) {
    if (!this.armedKey) return false;
    const hit = this.armedKey === key;
    if (hit && this.consumeOnce) this.armedKey = '';
    return hit;
  },
};

export class StorageWriteError extends Error {
  constructor(public storageKey: string) {
    super('写入 ' + storageKey + ' 中途失败（故障注入）');
    this.name = 'StorageWriteError';
  }
}

export function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed.version === STORAGE_VERSION ? parsed.data as T : fallback;
  } catch {
    console.warn(messages.storageRecovered);
    return fallback;
  }
}

export function saveLocal<T>(key: string, data: T) {
  // 模拟「写到一半失败」：序列化成功、准备落盘前抛错，
  // 这样旧值仍在 localStorage 里，由 WAL 恢复流程重放后续步骤。
  const serialized = JSON.stringify({ version: STORAGE_VERSION, data, updatedAt: new Date().toISOString() });
  if (faultInject.isArmedFor(key)) {
    throw new StorageWriteError(key);
  }
  localStorage.setItem(key, serialized);
}
