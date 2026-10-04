import type { SpotSnapshot } from './catalogVersion';

export type Transport = 'walk' | 'metro' | 'taxi' | 'train';

export interface DayPlanItem {
  spot_id: string;
  start_time: string;
  end_time: string;
  note: string;
  transport: Transport;
  // 非空表示这条安排所在天已确认：值为确认时固定的目录版本号。
  // 已确认条目不随目录调价 / 改分类而变。
  catalog_version?: number;
  // 确认那一刻冻结的景点价格与分类，与 catalog_version 成对出现。
  frozen?: SpotSnapshot;
}

export interface DayPlan {
  id: string;
  trip_id: string;
  day_index: number;
  date: string;
  items: DayPlanItem[];
  // 已确认当天行程时固定的目录版本；undefined 表示仍是未确认草稿，随目录最新版重算。
  confirmed_version?: number;
  confirmed_at?: string;
}
