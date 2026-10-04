import { TripStatus } from '../constants/trip';

export interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  budget: number;
  currency: string;
  members: string[];
  status: TripStatus;
  revision: number;
  created_at: string;
}
