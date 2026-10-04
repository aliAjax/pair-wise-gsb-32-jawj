import Dexie, { type Table } from 'dexie';
import { STORAGE_VERSION } from '../constants/storageVersion';
import { messages } from '../constants/messages';

class TripWeaverDb extends Dexie {
  trips!: Table<unknown, string>;
  spots!: Table<unknown, string>;
  dayPlans!: Table<unknown, string>;
  constructor() {
    super('tripweaver');
    this.version(2).stores({ trips: 'id,status,destination', spots: 'id,category', dayPlans: 'id,trip_id,day_index' });
  }
}

export const db = new TripWeaverDb();
const FAILURE_KEY = '__tripweaver_fail_storage_once__';

export function armStorageFailureOnce() {
  localStorage.setItem(FAILURE_KEY, String(Date.now()));
}

export function clearStorageFailure() {
  localStorage.removeItem(FAILURE_KEY);
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
  if (localStorage.getItem(FAILURE_KEY)) {
    localStorage.removeItem(FAILURE_KEY);
    throw new Error(messages.storageWriteInterrupted);
  }
  localStorage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, data, updatedAt: new Date().toISOString() }));
}
