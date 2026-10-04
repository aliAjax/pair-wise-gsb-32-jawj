import type { SaveJournal, JournalStepRecord } from '../models/journal';
import { JournalStatus } from '../constants/catalog';
import { journalApi } from '../api/journalApi';
import type { CatalogRevisionPayload, SavePlanPayload } from '../models/journal';
import { tripApi } from '../api/tripApi';
import { dayPlanApi } from '../api/dayPlanApi';
import { spotApi } from '../api/spotApi';
import { catalogApi } from '../api/catalogApi';
import { collabApi, type TripDraft } from '../api/collabApi';
import type { DayPlan } from '../models/dayPlan';
import type { PlanConflict } from '../models/conflict';
import { ConflictType, PlanStep, CatalogStep, SaveKind, ALL_STEP_LABELS } from '../constants/catalog';

export class ConflictDetected extends Error {
  constructor(public conflicts: PlanConflict[]) {
    super('conflict');
    this.name = 'ConflictDetected';
  }
}

function makeSteps(names: string[]): JournalStepRecord[] {
  return names.map((name) => ({ name, label: ALL_STEP_LABELS[name] || name, done: false }));
}

// 从 localStorage 重新读最新值（模拟「服务端」），这样两个标签页/两个同行人先后保存时
// 后到者能看到先到者已经提交的 revision 与已确认安排。
function fresh<T>(read: () => T): T {
  return read();
}

function buildConflict(
  payload: SavePlanPayload,
  type: ConflictType,
  mine: DayPlan | null,
  theirs: DayPlan | null,
  currentRevision: number,
): PlanConflict {
  return {
    id: crypto.randomUUID(),
    trip_id: payload.trip_id,
    day_index: mine?.day_index ?? theirs?.day_index ?? 0,
    type,
    mine,
    theirs,
    base_revision: payload.base_revision,
    current_revision: currentRevision,
    author: payload.author,
    created_at: new Date().toISOString(),
    resolved: false,
  };
}

// 保存计划的各步骤。每步都是幂等的：恢复时已 done 的步骤跳过，其余用 payload 重放。
const planHandlers: Record<PlanStep, (j: SaveJournal) => void> = {
  // 步骤 1：乐观锁校验。拿草稿里的 base_revision 与服务端最新 revision 比。
  [PlanStep.CHECK_REVISION](journal) {
    const payload = journal.payload as unknown as SavePlanPayload;
    const trips = fresh(() => tripApi.list());
    const serverTrip = trips.find((item) => item.id === payload.trip_id);
    const serverRevision = serverTrip?.revision ?? 0;
    if (serverRevision !== payload.base_revision) {
      const serverDays = fresh(() => dayPlanApi.list()).filter((day) => day.trip_id === payload.trip_id);
      const conflicts = payload.days
        .filter((mine) => {
          const theirs = serverDays.find((day) => day.day_index === mine.day_index);
          const changedByThem = !theirs || JSON.stringify(theirs.items) !== JSON.stringify(mine.items);
          // 后到者与先到者在同一天有不同安排才算冲突；完全相同的重复提交不算。
          return changedByThem;
        })
        .map((mine) => {
          const theirs = serverDays.find((day) => day.day_index === mine.day_index) ?? null;
          const touchedConfirmed = serverTrip?.confirmed_days.includes(mine.day_index) &&
            JSON.stringify(theirs?.items) !== JSON.stringify(mine.items);
          return buildConflict(
            payload,
            touchedConfirmed ? ConflictType.CONFIRMED_DAY : ConflictType.REVISION_MISMATCH,
            mine,
            theirs,
            serverRevision,
          );
        });
      if (conflicts.length) throw new ConflictDetected(conflicts);
    }
  },

  // 步骤 2：保护已确认安排。后到者即使 revision 相同，也不能覆盖任何已确认天。
  [PlanStep.GUARD_CONFIRMED](journal) {
    const payload = journal.payload as unknown as SavePlanPayload;
    const trips = fresh(() => tripApi.list());
    const serverTrip = trips.find((item) => item.id === payload.trip_id);
    if (!serverTrip) return;
    const serverDays = fresh(() => dayPlanApi.list()).filter((day) => day.trip_id === payload.trip_id);
    const conflicts: PlanConflict[] = [];
    for (const mine of payload.days) {
      const confirmed = serverTrip.confirmed_days.includes(mine.day_index);
      const theirs = serverDays.find((day) => day.day_index === mine.day_index) ?? null;
      const differs = JSON.stringify(theirs?.items) !== JSON.stringify(mine.items);
      if (confirmed && differs) {
        conflicts.push(buildConflict(payload, ConflictType.CONFIRMED_DAY, mine, theirs, serverTrip.revision));
      }
    }
    if (conflicts.length) throw new ConflictDetected(conflicts);
  },

  // 步骤 3：暂存后到者草稿（即便后续失败/冲突，草稿也完整保留）。
  [PlanStep.STAGE](journal) {
    const payload = journal.payload as unknown as SavePlanPayload;
    for (const day of payload.days) {
      const draft: TripDraft = {
        trip_id: payload.trip_id,
        day_index: day.day_index,
        author: payload.author,
        day,
        base_revision: payload.base_revision,
        updated_at: new Date().toISOString(),
      };
      collabApi.upsertDraft(draft);
    }
  },

  // 步骤 4：合并写入每日行程。按天 upsert，幂等；已确认天整体跳过。
  [PlanStep.WRITE_DAY_PLANS](journal) {
    const payload = journal.payload as unknown as SavePlanPayload;
    const all = fresh(() => dayPlanApi.list());
    const trips = fresh(() => tripApi.list());
    const confirmedDays = trips.find((item) => item.id === payload.trip_id)?.confirmed_days ?? [];
    for (const incoming of payload.days) {
      if (confirmedDays.includes(incoming.day_index)) continue; // 绝不覆盖已确认安排
      if (payload.confirm) {
        // 确认当天行程：固定当时目录版本与每条安排的价格、分类
        const snapshot = catalogApi.snapshotAt(payload.catalog_version);
        incoming.confirmed_version = payload.catalog_version;
        incoming.confirmed_at = new Date().toISOString();
        incoming.items = incoming.items.map((item) => {
          const frozen = snapshot?.spots[item.spot_id];
          return frozen ? { ...item, catalog_version: payload.catalog_version, frozen } : item;
        });
      }
      const idx = all.findIndex((day) => day.trip_id === payload.trip_id && day.day_index === incoming.day_index);
      if (idx >= 0) all[idx] = incoming;
      else all.push(incoming);
    }
    dayPlanApi.save(all);
  },

  // 步骤 5：提交计划版本号与确认天清单，最后一步完成才算整次保存生效。
  [PlanStep.WRITE_TRIP](journal) {
    const payload = journal.payload as unknown as SavePlanPayload;
    const trips = fresh(() => tripApi.list());
    const idx = trips.findIndex((item) => item.id === payload.trip_id);
    if (idx < 0) return;
    const trip = { ...trips[idx] };
    trip.revision = Math.max(trip.revision, payload.base_revision) + 1;
    if (payload.confirm) {
      trip.confirmed_days = Array.from(new Set([...trip.confirmed_days, ...payload.days.map((day) => day.day_index)]));
    }
    trips[idx] = trip;
    tripApi.save(trips);
  },
};

// 目录改版（调价 / 改分类 / 替换景点）的各步骤。
const catalogHandlers: Record<CatalogStep, (j: SaveJournal) => void> = {
  [CatalogStep.STAGE]() {
    // payload 在创建日志时已整体落盘，这一步保证暂存内容可读，占位但保留为独立步骤，
    // 恢复时若日志存在即说明改版内容已完整暂存。
  },

  // 步骤 2：追加目录版本快照（只追加不改写）
  [CatalogStep.WRITE_VERSION](journal) {
    const payload = journal.payload as unknown as CatalogRevisionPayload;
    const versions = catalogApi.versions();
    if (!versions.some((item) => item.version === payload.version)) {
      versions.push(payload.snapshot);
      catalogApi.saveVersions(versions);
    }
    catalogApi.saveLatest(payload.version);
  },

  // 步骤 3：写入改版后的景点目录
  [CatalogStep.WRITE_SPOTS](journal) {
    const payload = journal.payload as unknown as CatalogRevisionPayload;
    spotApi.save(payload.spots);
  },

  // 步骤 4：替换景点时清掉未确认行程里的旧引用；已确认安排靠 frozen 保留，不动
  [CatalogStep.PURGE_REFS](journal) {
    const payload = journal.payload as unknown as CatalogRevisionPayload;
    if (!payload.removed_spot_ids.length) return;
    const all = fresh(() => dayPlanApi.list());
    for (const day of all) {
      if (day.confirmed_version) continue;
      day.items = day.items.filter((item) => !payload.removed_spot_ids.includes(item.spot_id));
    }
    dayPlanApi.save(all);
  },

  // 步骤 5：回写受影响的每日行程（与步骤 4 合并落库；保留为恢复检查点）
  [CatalogStep.WRITE_DAY_PLANS]() {
    dayPlanApi.save(fresh(() => dayPlanApi.list()));
  },
};

function touch(journal: SaveJournal, status: JournalStatus, error?: string, failedStep?: string) {
  journal.status = status;
  journal.updated_at = new Date().toISOString();
  if (failedStep) {
    const step = journal.steps.find((item) => item.name === failedStep);
    if (step) step.error = error;
  }
  journalApi.append(journal);
}

// 跑一份日志：从 completed 下标继续，逐步骤标记 done 并落盘。
// 冲突与写失败分别落到 CONFLICTED / INTERRUPTED 状态，保留完整步骤，等待恢复。
export function runJournal(journal: SaveJournal): SaveJournal {
  const handlers = journal.kind === 'save_plan' ? planHandlers : catalogHandlers;
  for (let i = journal.completed; i < journal.steps.length; i++) {
    const step = journal.steps[i];
    try {
      (handlers as Record<string, (j: SaveJournal) => void>)[step.name](journal);
    } catch (err) {
      if (err instanceof ConflictDetected) {
        // 冲突：保留后到者草稿（步骤3尚未执行也没关系，这里补存），登记按天冲突
        const payload = journal.payload as unknown as SavePlanPayload;
        for (const day of payload.days) {
          collabApi.upsertDraft({
            trip_id: payload.trip_id,
            day_index: day.day_index,
            author: payload.author,
            day,
            base_revision: payload.base_revision,
            updated_at: new Date().toISOString(),
          });
        }
        const existing = collabApi.conflicts();
        collabApi.saveConflicts([...existing, ...err.conflicts]);
        touch(journal, JournalStatus.CONFLICT, err.message, step.name);
        return journal;
      }
      touch(journal, JournalStatus.INTERRUPTED, (err as Error).message, step.name);
      return journal;
    }
    step.done = true;
    step.error = undefined;
    journal.completed = i + 1;
    touch(journal, JournalStatus.INTERRUPTED); // 每步落盘：中途断电也能从 completed 续上
  }
  touch(journal, JournalStatus.DONE);
  journalApi.clearActive();
  return journal;
}

export function createSavePlanJournal(payload: SavePlanPayload): SaveJournal {
  const now = new Date().toISOString();
  const journal: SaveJournal = {
    id: crypto.randomUUID(),
    kind: SaveKind.SAVE_PLAN,
    status: JournalStatus.INTERRUPTED,
    created_at: now,
    updated_at: now,
    completed: 0,
    steps: makeSteps(Object.values(PlanStep)),
    payload: payload as unknown as Record<string, unknown>,
  };
  journalApi.append(journal); // 先写完整步骤日志，再开始执行
  return runJournal(journal);
}

export function createCatalogJournal(payload: CatalogRevisionPayload): SaveJournal {
  const now = new Date().toISOString();
  const journal: SaveJournal = {
    id: crypto.randomUUID(),
    kind: SaveKind.CATALOG_REVISION,
    status: JournalStatus.INTERRUPTED,
    created_at: now,
    updated_at: now,
    completed: 0,
    steps: makeSteps(Object.values(CatalogStep)),
    payload: payload as unknown as Record<string, unknown>,
  };
  journalApi.append(journal);
  return runJournal(journal);
}
