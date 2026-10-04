import { ConflictType } from '../constants/catalog';

// 两个人先后保存同一计划时，给后到者保留下来的按天冲突记录。
// 冲突没处理完，分享预览会停住并指出是哪几天。
export interface PlanConflict {
  id: string;
  trip_id: string;
  day_index: number;
  type: ConflictType;
  // 后到者（自己）的草稿那天
  mine: import('./dayPlan').DayPlan | null;
  // 先到者已经落库的那天
  theirs: import('./dayPlan').DayPlan | null;
  // 自己提交时拿的旧版本号 / 服务端当前版本号
  base_revision: number;
  current_revision: number;
  author: string;
  created_at: string;
  resolved: boolean;
}
