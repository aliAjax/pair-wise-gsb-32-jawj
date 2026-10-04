import type { CatalogVersion, SpotSnapshot } from '../models/catalogVersion';
import { SpotCategory } from '../constants/spot';
import { INITIAL_CATALOG_VERSION } from '../constants/catalog';
import { STORAGE_KEYS } from '../constants/storageVersion';
import { loadLocal, saveLocal } from '../utils/storage';
import type { Spot } from '../models/spot';

export function spotsToSnapshot(spots: Spot[]): Record<string, SpotSnapshot> {
  return Object.fromEntries(spots.map((spot) => [spot.id, { name: spot.name, category: spot.category, price: spot.price }]));
}

export function buildVersion(version: number, note: string, spots: Spot[]): CatalogVersion {
  return { version, note, created_at: new Date().toISOString(), spots: spotsToSnapshot(spots) };
}

export const catalogApi = {
  versions: () => loadLocal<CatalogVersion[]>(STORAGE_KEYS.catalogVersions, []),
  latestVersion: () => loadLocal<number>(STORAGE_KEYS.catalogLatest, INITIAL_CATALOG_VERSION),
  saveVersions: (items: CatalogVersion[]) => saveLocal(STORAGE_KEYS.catalogVersions, items),
  saveLatest: (version: number) => saveLocal(STORAGE_KEYS.catalogLatest, version),
  // 首次进入：用种子目录补出第 1 版，只追加不改写
  ensureSeeded(spots: Spot[]): CatalogVersion[] {
    const existing = this.versions();
    if (!existing.length) {
      const first = buildVersion(INITIAL_CATALOG_VERSION, '初始目录', spots);
      this.saveVersions([first]);
      this.saveLatest(INITIAL_CATALOG_VERSION);
      return [first];
    }
    return existing;
  },
  snapshotAt(version: number): CatalogVersion | undefined {
    return this.versions().find((item) => item.version === version);
  },
  // 兜底快照：找不到冻结版本（例如旧数据）时，至少给出未知景点的可渲染结构
  fallbackSnapshot(): SpotSnapshot {
    return { name: '已下架景点', category: SpotCategory.ENTERTAINMENT, price: 0 };
  },
};
