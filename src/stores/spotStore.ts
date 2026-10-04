import { defineStore } from 'pinia';
import type { Spot } from '../models/spot';
import { SpotCategory } from '../constants/spot';
import { spotApi } from '../api/spotApi';
import { useCatalogStore } from './catalogStore';

// 景点目录的唯一数据源是 catalogStore（可续作的目录版本）。
// 这里只保留搜索/筛选/收藏这类页面态，spots 直接透传目录，避免两份状态不一致。
export const useSpotStore = defineStore('spot', {
  state: () => ({ keyword: '', category: 'all' as SpotCategory | 'all', favorites: [] as string[] }),
  getters: {
    spots(): Spot[] {
      return useCatalogStore().spots;
    },
    filteredSpots(): Spot[] {
      return this.spots.filter((spot) => {
        const matchKeyword = !this.keyword || spot.name.includes(this.keyword) || spot.tags.some((tag) => tag.includes(this.keyword));
        const matchCategory = this.category === 'all' || spot.category === this.category;
        return matchKeyword && matchCategory;
      });
    },
  },
  actions: {
    toggleFavorite(id: string) {
      this.favorites = this.favorites.includes(id) ? this.favorites.filter((item) => item !== id) : [...this.favorites, id];
    },
  },
});
