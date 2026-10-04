import { defineStore } from 'pinia';
import type { CatalogVersion } from '../models/catalogVersion';
import type { Spot } from '../models/spot';
import type { DayPlan } from '../models/dayPlan';
import type { TripDraft } from '../models/draft';
import { SpotCategory } from '../constants/spot';
import { seedSpots, spotApi } from '../api/spotApi';
import { catalogVersionApi } from '../api/catalogVersionApi';
import { dayPlanApi } from '../api/dayPlanApi';
import { draftApi } from '../api/draftApi';
import { messages } from '../constants/messages';
import { toast } from '../utils/message';
import { createCatalogVersion, replaceSpotReferences } from '../utils/catalog';

function normalizeVersion(items: CatalogVersion[]): CatalogVersion[] {
  if (items.length) return items;
  return [{
    id: crypto.randomUUID(),
    version: 1,
    name: '初始目录',
    changed_spot_ids: seedSpots.map((spot) => spot.id),
    created_at: new Date().toISOString(),
  }];
}

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    spots: spotApi.list() as Spot[],
    versions: normalizeVersion(catalogVersionApi.list()),
    keyword: '',
    category: 'all' as SpotCategory | 'all',
    favorites: [] as string[],
  }),
  getters: {
    currentVersion: (state) => Math.max(1, ...state.versions.map((item) => item.version)),
    filteredSpots: (state) => state.spots.filter((spot) => {
      const matchKeyword = !state.keyword || spot.name.includes(state.keyword) || spot.tags.some((tag) => tag.includes(state.keyword));
      const matchCategory = state.category === 'all' || spot.category === state.category;
      return matchKeyword && matchCategory;
    }),
  },
  actions: {
    persistVersions() {
      catalogVersionApi.save(this.versions);
    },
    publishCatalog(nextSpots: Spot[], name?: string) {
      const changedIds = nextSpots
        .filter((next) => {
          const previous = this.spots.find((spot) => spot.id === next.id);
          return previous && (previous.price !== next.price || previous.category !== next.category);
        })
        .map((spot) => spot.id);
      this.spots = nextSpots;
      spotApi.save(this.spots);
      if (!changedIds.length) {
        toast.ok(messages.catalogSaved);
        return this.currentVersion;
      }
      const version = this.currentVersion + 1;
      this.versions.push(createCatalogVersion(version, changedIds, name));
      this.persistVersions();
      toast.ok(messages.catalogPublished);
      return version;
    },
    updateSpotPriceAndCategory(id: string, price: number, category: SpotCategory) {
      const next = this.spots.map((spot) => spot.id === id ? { ...spot, price, category } : spot);
      return this.publishCatalog(next);
    },
    replaceSpotReference(oldSpotId: string, nextSpotId: string) {
      const dayPlans: DayPlan[] = replaceSpotReferences(dayPlanApi.list(), oldSpotId, nextSpotId);
      const drafts: TripDraft[] = draftApi.list().map((draft) => ({
        ...draft,
        days: replaceSpotReferences(draft.days, oldSpotId, nextSpotId),
        updated_at: new Date().toISOString(),
      }));
      dayPlanApi.save(dayPlans);
      draftApi.save(drafts);
      toast.ok(messages.spotReferencesReplaced);
    },
    toggleFavorite(id: string) {
      this.favorites = this.favorites.includes(id) ? this.favorites.filter((item) => item !== id) : [...this.favorites, id];
    },
  },
});
