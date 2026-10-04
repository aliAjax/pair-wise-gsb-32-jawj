import type { SpotCategory } from '../constants/spot';

export type CurrencyCode = 'CNY' | 'USD' | 'EUR' | 'JPY';
export interface PersistedPayload<T> { version: string; data: T; updatedAt: string }
export interface DraftRef { key: string; tripId: string; editor: string }

export interface EffectiveSpot {
  id: string;
  name: string;
  price: number;
  category: SpotCategory | 'unknown';
  catalogVersion: number;
  source: 'current' | 'confirmed';
  snapshotAt?: string;
}
