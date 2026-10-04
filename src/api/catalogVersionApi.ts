import type { CatalogVersion } from '../models/catalogVersion';
import { STORAGE_KEYS } from '../constants/storageVersion';
import { loadLocal, saveLocal } from '../utils/storage';

export const catalogVersionApi = {
  list: () => loadLocal<CatalogVersion[]>(STORAGE_KEYS.catalogVersions, []),
  save: (items: CatalogVersion[]) => saveLocal(STORAGE_KEYS.catalogVersions, items),
};
