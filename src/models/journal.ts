import { JournalStatus, SaveKind } from '../constants/catalog';

// 一次「保存写到一半」的完整步骤日志（WAL）。
// 先把全部步骤落盘，再逐步执行；任何一步失败，下次启动按同样顺序从断点恢复。
export interface JournalStepRecord {
  name: string;
  label: string;
  done: boolean;
  // 失败的那一步的错误信息，恢复栏会点名这一步。
  error?: string;
}

export interface SaveJournal {
  id: string;
  kind: SaveKind;
  status: JournalStatus;
  created_at: string;
  updated_at: string;
  // 已经成功跑完的步骤数；恢复时从这个下标继续（前面步骤均幂等）。
  completed: number;
  steps: JournalStepRecord[];
  // 各执行步骤需要的入参，全部 JSON 可序列化，恢复时不依赖内存。
  payload: Record<string, unknown>;
}

// 保存计划步骤所需的负载
export interface SavePlanPayload {
  trip_id: string;
  author: string;
  base_revision: number;
  // 后到者本次要保存的那几天
  days: import('./dayPlan').DayPlan[];
  // 是否同时确认这些天（确认时冻结目录版本）
  confirm: boolean;
  catalog_version: number;
}

// 目录改版步骤所需的负载
export interface CatalogRevisionPayload {
  version: number;
  note: string;
  // 改版后的整份景点目录（写入 spots 表）
  spots: import('./spot').Spot[];
  // 被替换 / 下架的旧 spot_id，用于从未确认行程里清掉旧引用
  removed_spot_ids: string[];
  // 该版本的完整快照
  snapshot: import('./catalogVersion').CatalogVersion;
}
