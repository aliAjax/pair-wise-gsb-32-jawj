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
  created_at: string;
  // 乐观锁版本号：每次已确认 / 已保存的安排发生变化就 +1。
  // 两个人先后保存同一计划时，后到者拿旧 revision 提交会被第一步拦下。
  revision: number;
  // 已经确认的天（day_index），确认后的安排不允许任何后来者覆盖。
  confirmed_days: number[];
}
