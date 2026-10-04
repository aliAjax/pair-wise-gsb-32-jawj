import type { DayPlan } from '../models/dayPlan';
import type { Spot } from '../models/spot';
import type { Trip } from '../models/trip';
import type { EffectiveSpot } from '../types';
import { messages } from '../constants/messages';
import { toEffectiveSpot } from './catalog';

export function effectiveSpotsForDay(day: DayPlan, spots: Spot[]): EffectiveSpot[] {
  return day.items.map((item) => {
    const current = spots.find((spot) => spot.id === item.spot_id);
    if (current) return toEffectiveSpot(current, item);
    if (item.snapshot) return toEffectiveSpot({ id: item.snapshot.spot_id } as Spot, item);
    return {
      id: item.spot_id,
      name: '未知景点',
      price: 0,
      category: 'unknown',
      catalogVersion: 0,
      source: 'current',
    };
  });
}

export function calcTripCost(dayPlans: DayPlan[], spots: Spot[]) {
  return dayPlans.reduce((sum, day) => {
    return sum + effectiveSpotsForDay(day, spots).reduce((inner, spot) => inner + spot.price, 0);
  }, 0);
}

export function budgetStatus(trip: Trip, dayPlans: DayPlan[], spots: Spot[]) {
  const spent = calcTripCost(dayPlans, spots);
  return { spent, remaining: trip.budget - spent, warning: spent > trip.budget ? messages.budgetExceeded : '' };
}
