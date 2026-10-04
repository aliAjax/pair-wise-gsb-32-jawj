import type { CatalogVersion, SpotSnapshot } from '../models/catalogVersion';
import type { DayPlan, DayPlanItem } from '../models/dayPlan';
import type { Spot } from '../models/spot';
import { catalogApi } from '../api/catalogApi';

// 「这一条安排按哪版算」的统一入口，被 DayTimeline、预算计算、分享单共用：
// - 已确认条目：用确认时冻结的价格与分类（frozen），目录再怎么调都不变；
// - 未确认条目：跟随目录最新版实时重算；
// - 目录里已找不到（被替换/下架）：回退到最近一版含该景点的快照，再不行用兜底结构。
export function resolveItemSnapshot(
  item: DayPlanItem,
  latestSpots: Spot[],
  versions: CatalogVersion[],
): SpotSnapshot {
  if (item.frozen) return item.frozen;
  const live = latestSpots.find((spot) => spot.id === item.spot_id);
  if (live) return { name: live.name, category: live.category, price: live.price };
  for (let i = versions.length - 1; i >= 0; i--) {
    const past = versions[i].spots[item.spot_id];
    if (past) return past;
  }
  return catalogApi.fallbackSnapshot();
}

export interface ResolvedDayItem extends DayPlanItem {
  snapshot: SpotSnapshot;
  // true = 按确认时的固定价；false = 按目录最新版
  pinned: boolean;
}

export function resolveDay(day: DayPlan, latestSpots: Spot[], versions: CatalogVersion[]): ResolvedDayItem[] {
  return day.items.map((item) => {
    const snapshot = resolveItemSnapshot(item, latestSpots, versions);
    return { ...item, snapshot, pinned: Boolean(item.frozen) };
  });
}

// 未确认行程是否还引用着某个（已被替换/下架的）景点
export function dayReferencesSpot(day: DayPlan, spotId: string) {
  return day.items.some((item) => item.spot_id === spotId && !item.frozen);
}
