import type { CatalogVersion } from '../models/catalogVersion';
import type { DayPlan } from '../models/dayPlan';
import type { Spot } from '../models/spot';
import type { Trip } from '../models/trip';
import { messages } from '../constants/messages';
import { resolveDay } from './versionResolver';

// 预算规则横跨 budgetCalculator / useTripStats / BudgetChart / 详情页 / 分享页：
// 已确认条目取确认时冻结价，未确认条目按目录最新版重算。
export function calcTripCost(dayPlans: DayPlan[], spots: Spot[], versions: CatalogVersion[] = []) {
  return dayPlans.reduce((sum, day) => {
    return sum + resolveDay(day, spots, versions).reduce((inner, item) => inner + item.snapshot.price, 0);
  }, 0);
}

export function budgetStatus(trip: Trip, dayPlans: DayPlan[], spots: Spot[], versions: CatalogVersion[] = []) {
  const spent = calcTripCost(dayPlans, spots, versions);
  return { spent, remaining: trip.budget - spent, warning: spent > trip.budget ? messages.budgetExceeded : '' };
}
