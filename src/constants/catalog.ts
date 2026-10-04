// 目录版本与保存事务相关的共享常量。
// 事务步骤名被 journal 执行器、恢复栏、分享页闸门同时引用，改一处即牵一发动全身。

export const INITIAL_CATALOG_VERSION = 1;

export enum SaveKind {
  // 两人先后保存同一计划
  SAVE_PLAN = 'save_plan',
  // 目录调价 / 改分类 / 替换景点
  CATALOG_REVISION = 'catalog_revision',
}

export enum JournalStatus {
  // 步骤全部跑完
  DONE = 'done',
  // 跑到一半写失败，等待从完整步骤恢复
  INTERRUPTED = 'interrupted',
  // 第一步乐观锁校验发现冲突，草稿已保留，等待用户处理
  CONFLICT = 'conflict',
}

// 保存计划的固定步骤（顺序即含义，下标不能随意调换，恢复时按序幂等重放）
export enum PlanStep {
  CHECK_REVISION = 'check_revision',
  GUARD_CONFIRMED = 'guard_confirmed',
  STAGE = 'stage',
  WRITE_DAY_PLANS = 'write_day_plans',
  WRITE_TRIP = 'write_trip',
}

export const PLAN_STEP_LABELS: Record<PlanStep, string> = {
  [PlanStep.CHECK_REVISION]: '校验计划版本',
  [PlanStep.GUARD_CONFIRMED]: '保护已确认安排',
  [PlanStep.STAGE]: '暂存本次草稿',
  [PlanStep.WRITE_DAY_PLANS]: '写入每日行程',
  [PlanStep.WRITE_TRIP]: '提交计划版本号',
};

// 目录改版的固定步骤
export enum CatalogStep {
  STAGE = 'stage',
  WRITE_VERSION = 'write_version',
  WRITE_SPOTS = 'write_spots',
  PURGE_REFS = 'purge_refs',
  WRITE_DAY_PLANS = 'write_day_plans',
}

export const CATALOG_STEP_LABELS: Record<CatalogStep, string> = {
  [CatalogStep.STAGE]: '暂存目录改版内容',
  [CatalogStep.WRITE_VERSION]: '写入新目录版本',
  [CatalogStep.WRITE_SPOTS]: '写入景点目录',
  [CatalogStep.PURGE_REFS]: '清理未确认行程中的旧引用',
  [CatalogStep.WRITE_DAY_PLANS]: '回写受影响的每日行程',
};

export const ALL_STEP_LABELS: Record<string, string> = { ...PLAN_STEP_LABELS, ...CATALOG_STEP_LABELS };

export enum ConflictType {
  // 后到者的计划版本落后
  REVISION_MISMATCH = 'revision_mismatch',
  // 后到者改动了对方已确认的天
  CONFIRMED_DAY = 'confirmed_day',
}
