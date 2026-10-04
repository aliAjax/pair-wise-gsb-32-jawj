import type { CatalogVersion } from '../models/catalogVersion';
import type { DayPlan, DayPlanItem } from '../models/dayPlan';
import type { Spot, SpotSnapshot } from '../models/spot';
import type { EffectiveSpot } from '../types';

export function cloneData<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createSpotSnapshot(spot: Spot, catalogVersion: number): SpotSnapshot {
  return {
    spot_id: spot.id,
    name: spot.name,
    category: spot.category,
    price: spot.price,
    catalog_version: catalogVersion,
    snapshot_at: new Date().toISOString(),
  };
}

export function snapshotIsEmpty(snapshot?: SpotSnapshot) {
  return !snapshot || !snapshot.snapshot_at;
}

export function toEffectiveSpot(spot: Spot, item?: DayPlanItem): EffectiveSpot {
  if (item?.snapshot) {
    return {
      id: item.snapshot.spot_id,
      name: item.snapshot.name,
      price: item.snapshot.price,
      category: item.snapshot.category,
      catalogVersion: item.snapshot.catalog_version,
      source: 'confirmed',
      snapshotAt: item.snapshot.snapshot_at,
    };
  }
  return {
    id: spot.id,
    name: spot.name,
    price: spot.price,
    category: spot.category,
    catalogVersion: 0,
    source: 'current',
  };
}

export function attachConfirmationSnapshots(day: DayPlan, spots: Spot[], catalogVersion: number): DayPlan {
  return {
    ...day,
    items: day.items.map((item) => {
      const spot = spots.find((entry) => entry.id === item.spot_id);
      return {
        ...item,
        snapshot: snapshotIsEmpty(item.snapshot) && spot ? createSpotSnapshot(spot, catalogVersion) : item.snapshot,
      };
    }),
  };
}

export function replaceItemSpot(item: DayPlanItem, nextSpotId: string): DayPlanItem {
  return { ...item, spot_id: nextSpotId, snapshot: undefined };
}

export function replaceSpotReferences(
  dayPlans: DayPlan[],
  oldSpotId: string,
  nextSpotId: string,
  includeConfirmed = false,
) {
  return dayPlans.map((day) => {
    if (!includeConfirmed && day.confirmed_at) return day;
    return {
      ...day,
      items: day.items.map((item) => item.spot_id === oldSpotId ? replaceItemSpot(item, nextSpotId) : item),
    };
  });
}

export function createCatalogVersion(version: number, changedSpotIds: string[], name = `目录 v${version}`): CatalogVersion {
  return {
    id: crypto.randomUUID(),
    version,
    name,
    changed_spot_ids: Array.from(new Set(changedSpotIds)),
    created_at: new Date().toISOString(),
  };
}
