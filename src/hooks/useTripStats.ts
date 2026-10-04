import { computed, type ComputedRef } from 'vue';
import type { Trip } from '../models/trip';
import type { DayPlan } from '../models/dayPlan';
import type { Spot } from '../models/spot';
import type { CatalogVersion } from '../models/catalogVersion';
import { budgetStatus } from '../utils/budgetCalculator';

export interface TripStatsValue {
  days: number;
  spotCount: number;
  budget: { spent: number; remaining: number; warning: string };
}

type MaybeRef<T> = T | ComputedRef<T>;
function unwrap<T>(value: MaybeRef<T>): T {
  return value && typeof value === 'object' && 'value' in value ? (value as ComputedRef<T>).value : value;
}

const EMPTY: TripStatsValue = { days: 0, spotCount: 0, budget: { spent: 0, remaining: 0, warning: '' } };

// 预算横跨 hook / calculator / BudgetChart / 详情页 / 分享页：
// 已确认条目按确认时冻结价，未确认条目按目录最新版重算。
export function useTripStats(
  trip: MaybeRef<Trip | undefined>,
  dayPlans: MaybeRef<DayPlan[]>,
  spots: MaybeRef<Spot[]>,
  versions: MaybeRef<CatalogVersion[]> = [] as CatalogVersion[],
): ComputedRef<TripStatsValue> {
  return computed(() => {
    const current = unwrap(trip);
    if (!current) return EMPTY;
    const tripDays = unwrap(dayPlans).filter((day) => day.trip_id === current.id);
    return {
      days: Math.max(1, tripDays.length),
      spotCount: tripDays.reduce((sum, day) => sum + day.items.length, 0),
      budget: budgetStatus(current, tripDays, unwrap(spots), unwrap(versions)),
    };
  });
}
