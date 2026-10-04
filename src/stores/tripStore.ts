import { defineStore } from 'pinia';
import { TripStatus } from '../constants/trip';
import type { Trip } from '../models/trip';
import { tripApi } from '../api/tripApi';
import { dayPlanApi } from '../api/dayPlanApi';
import { draftApi } from '../api/draftApi';
import { conflictApi } from '../api/conflictApi';
import { messages } from '../constants/messages';
import { toast } from '../utils/message';

function normalizeTrip(trip: Trip): Trip {
  return { ...trip, revision: trip.revision || 1 };
}

export const useTripStore = defineStore('trip', {
  state: () => ({ trips: tripApi.list().map(normalizeTrip) as Trip[], statusFilter: 'all' as TripStatus | 'all' }),
  getters: {
    filteredTrips: (state) => state.statusFilter === 'all' ? state.trips : state.trips.filter((trip) => trip.status === state.statusFilter),
  },
  actions: {
    persist() {
      tripApi.save(this.trips);
    },
    reload(trips: Trip[]) {
      this.trips = trips;
    },
    bumpRevision(id: string) {
      const trip = this.trips.find((item) => item.id === id);
      if (!trip) return;
      trip.revision += 1;
      this.persist();
    },
    createTrip(title = '杭州周末慢旅行') {
      const trip: Trip = {
        id: crypto.randomUUID(),
        title,
        destination: '杭州',
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
        budget: 3200,
        currency: 'CNY',
        members: ['我', '朋友'],
        status: TripStatus.PLANNING,
        revision: 1,
        created_at: new Date().toISOString(),
      };
      this.trips.unshift(trip);
      this.persist();
      toast.ok(messages.tripCreated);
      return trip.id;
    },
    removeTrip(id: string) {
      this.trips = this.trips.filter((trip) => trip.id !== id);
      dayPlanApi.save(dayPlanApi.list().filter((day) => day.trip_id !== id));
      draftApi.save(draftApi.list().filter((draft) => draft.trip_id !== id));
      conflictApi.save(conflictApi.list().filter((conflict) => conflict.trip_id !== id));
      this.persist();
      toast.ok(messages.tripDeleted);
    },
  },
});
