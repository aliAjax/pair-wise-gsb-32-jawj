// 核心流程冒烟测试（不进前端构建）：用内存 localStorage 桩验证
// 1) 确认固定价 / 目录调价后未确认重算、预算口径
// 2) 两人先后保存的乐观锁冲突 + 不覆盖已确认
// 3) 替换景点清理未确认旧引用、已确认仍可读
// 4) 保存写到一半失败后从完整步骤恢复
import { assert } from 'node:console';

// ---- 内存 localStorage ----
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const { seedSpots } = await import('../src/api/spotApi');
const { spotApi } = await import('../src/api/spotApi');
const { catalogApi } = await import('../src/api/catalogApi');
const { tripApi } = await import('../src/api/tripApi');
const { dayPlanApi } = await import('../src/api/dayPlanApi');
const { collabApi } = await import('../src/api/collabApi');
const { journalApi } = await import('../src/api/journalApi');
const { createSavePlanJournal, createCatalogJournal, runJournal } = await import('../src/utils/journalRunner');
const { calcTripCost } = await import('../src/utils/budgetCalculator');
const { resolveDay } = await import('../src/utils/versionResolver');
const { faultInject } = await import('../src/utils/storage');
const { STORAGE_KEYS } = await import('../src/constants/storageVersion');
const { JournalStatus } = await import('../src/constants/catalog');
const { buildVersion } = await import('../src/api/catalogApi');

let passed = 0;
function check(name: string, cond: boolean) {
  if (!cond) throw new Error('FAIL: ' + name);
  passed++;
  console.log('  ✓', name);
}

// ---- 初始数据 ----
spotApi.save(seedSpots);
const trip = {
  id: 'trip-1', title: 'T', destination: '杭州', start_date: '2026-10-01', end_date: '2026-10-02',
  budget: 1000, currency: 'CNY', members: ['A', 'B'], status: 'planning', created_at: '', revision: 0, confirmed_days: [],
};
tripApi.save([trip]);
catalogApi.ensureSeeded(seedSpots);
const museum = seedSpots.find((s) => s.id === 'spot-museum')!; // price 60 culture
const market = seedSpots.find((s) => s.id === 'spot-market')!; // price 120 food

function day(day_index: number, spot_ids: string[], tripId = 'trip-1') {
  return {
    id: 'd-' + day_index + '-' + Math.random().toString(36).slice(2, 7),
    trip_id: tripId, day_index, date: '2026-10-0' + day_index,
    items: spot_ids.map((sid) => ({ spot_id: sid, start_time: '10:00', end_time: '12:00', note: '', transport: 'metro' as const })),
  };
}

console.log('流程 1：确认固定价 + 目录调价后未确认重算');
{
  // A 保存第1天（museum 60）并确认；第2天（market 120）只保存不确认
  const j1 = createSavePlanJournal({ trip_id: 'trip-1', author: 'A', base_revision: 0, days: [day(1, ['spot-museum'])], confirm: true, catalog_version: 1 });
  check('A 确认第1天成功', j1.status === JournalStatus.DONE);
  const j2 = createSavePlanJournal({ trip_id: 'trip-1', author: 'A', base_revision: 1, days: [day(2, ['spot-market'])], confirm: false, catalog_version: 1 });
  check('A 保存第2天成功', j2.status === JournalStatus.DONE);

  const plans = dayPlanApi.list();
  const d1 = plans.find((p) => p.day_index === 1)!;
  const d2 = plans.find((p) => p.day_index === 2)!;
  check('第1天已确认且条目冻结价 60', d1.confirmed_version === 1 && d1.items[0].frozen?.price === 60);
  check('第2天未确认无冻结', !d2.confirmed_version && !d2.items[0].frozen);

  // 目录出 v2：museum 60→80，market 120→200
  const v2spots = seedSpots.map((s) => s.id === 'spot-museum' ? { ...s, price: 80 } : s.id === 'spot-market' ? { ...s, price: 200 } : s);
  const cj = createCatalogJournal({ version: 2, note: '调价', spots: v2spots, removed_spot_ids: [], snapshot: buildVersion(2, '调价', v2spots) });
  check('目录 v2 发布成功', cj.status === JournalStatus.DONE);
  const versions = catalogApi.versions();

  const r1 = resolveDay(d1, v2spots, versions);
  const r2 = resolveDay(d2, v2spots, versions);
  check('已确认第1天仍按固定价 60', r1[0].snapshot.price === 60 && r1[0].pinned === true);
  check('未确认第2天按最新价 200', r2[0].snapshot.price === 200 && r2[0].pinned === false);

  const cost = calcTripCost(dayPlanApi.list(), v2spots, versions);
  check('预算合计 = 60(固定) + 200(最新) = 260', cost === 260);
}

console.log('流程 2：两人先后保存 → 后到者冲突，保留草稿，不覆盖已确认');
{
  // B 基于 revision 0（落后）提交第3天，并且还想改已确认的第1天
  const bDay3 = day(3, ['spot-park']); // 新天
  const bDay1 = day(1, ['spot-market']); // 想覆盖第1天（已确认）
  const jb = createSavePlanJournal({ trip_id: 'trip-1', author: 'B', base_revision: 0, days: [bDay3, bDay1], confirm: false, catalog_version: 2 });
  check('B 旧版本提交被拦在冲突态', jb.status === JournalStatus.CONFLICT);
  const conflicts = collabApi.conflicts();
  check('生成了按天冲突记录', conflicts.length >= 2);
  const c1 = conflicts.find((c) => c.day_index === 1)!;
  check('对已确认第1天的冲突类型是 CONFIRMED_DAY', c1.type === 'confirmed_day');
  const drafts = collabApi.drafts().filter((d) => d.author === 'B');
  check('B 的草稿被完整保留', drafts.some((d) => d.day_index === 1) && drafts.some((d) => d.day_index === 3));

  // 已确认第1天内容未被 B 覆盖
  const d1 = dayPlanApi.list().find((p) => p.day_index === 1)!;
  check('第1天仍为 museum 固定价，未被 B 的 market 覆盖', d1.items[0].spot_id === 'spot-museum');

  // 服务端没有写入第3天（整次保存因冲突未生效）
  check('第3天没有被写入库', !dayPlanApi.list().some((p) => p.day_index === 3));

  // B 处理冲突：对第3天（非已确认）保留草稿、带最新 revision 重提成功
  const c3 = conflicts.find((c) => c.day_index === 3)!;
  const retry = createSavePlanJournal({ trip_id: 'trip-1', author: 'B', base_revision: 2, days: [c3.mine!], confirm: false, catalog_version: 2 });
  check('B 带新 revision 重提第3天成功', retry.status === JournalStatus.DONE);
  check('第3天已写入', dayPlanApi.list().some((p) => p.day_index === 3));
}

console.log('流程 3：替换景点 → 清未确认旧引用，已确认仍可读');
{
  // 再加一个未确认第4天引用 museum
  const d4 = day(4, ['spot-museum']);
  const j = createSavePlanJournal({ trip_id: 'trip-1', author: 'A', base_revision: 3, days: [d4], confirm: false, catalog_version: 2 });
  check('第4天保存成功', j.status === JournalStatus.DONE);

  const v3spots = seedSpots.filter((s) => s.id !== 'spot-museum').concat([{ ...museum, id: 'spot-museum-2', name: '博物馆新馆', price: 90 }]);
  const cj = createCatalogJournal({ version: 3, note: '替换', spots: v3spots, removed_spot_ids: ['spot-museum'], snapshot: buildVersion(3, '替换', v3spots) });
  check('替换景点事务成功', cj.status === JournalStatus.DONE);

  const plans = dayPlanApi.list();
  const confirmedD1 = plans.find((p) => p.day_index === 1)!;
  const unconfirmedD4 = plans.find((p) => p.day_index === 4)!;
  check('未确认第4天的旧 museum 引用被清掉', unconfirmedD4.items.length === 0);
  check('已确认第1天仍保留 museum 冻结快照可计价', confirmedD1.items[0].spot_id === 'spot-museum' && confirmedD1.items[0].frozen?.price === 60);
}

console.log('流程 4：保存写一半失败 → 从完整步骤恢复');
{
  // 新计划，干净环境
  const trip2 = { id: 'trip-2', title: 'T2', destination: 'X', start_date: '', end_date: '', budget: 500, currency: 'CNY', members: [], status: 'planning', created_at: '', revision: 0, confirmed_days: [] };
  tripApi.save(tripApi.list().concat(trip2));

  // 让写入 dayPlans 那一步失败
  faultInject.arm(STORAGE_KEYS.dayPlans);
  const jf = createSavePlanJournal({ trip_id: 'trip-2', author: 'A', base_revision: 0, days: [day(1, ['spot-park'], 'trip-2')], confirm: true, catalog_version: catalogApi.latestVersion() });
  check('保存停在 INTERRUPTED', jf.status === JournalStatus.INTERRUPTED);
  check('已跑完 3 步（校验/保护/暂存）', jf.completed === 3 && jf.steps[0].done && jf.steps[1].done && jf.steps[2].done);
  check('写行程步骤标记了错误', Boolean(jf.steps[3].error));
  // trip2 revision 尚未增加（最后一步没跑）
  check('版本号尚未提交，仍为 0', tripApi.list().find((t) => t.id === 'trip-2')!.revision === 0);
  check('草稿已暂存可回看', collabApi.drafts().some((d) => d.trip_id === 'trip-2'));

  // 恢复：同一日志从断点重放
  const active = journalApi.active()!;
  const resumed = runJournal(active);
  check('恢复后全部步骤完成', resumed.status === JournalStatus.DONE && resumed.completed === resumed.steps.length);
  const savedTrip2Day = dayPlanApi.list().find((p) => p.trip_id === 'trip-2' && p.day_index === 1);
  check('第1天已确认写入并冻结', Boolean(savedTrip2Day?.confirmed_version) && savedTrip2Day!.items[0].frozen?.price === 180);
  check('版本号已提交为 1', tripApi.list().find((t) => t.id === 'trip-2')!.revision === 1);
  check('活动日志已清空', journalApi.activeId() === '');

  // 再次恢复是幂等的：没有活动日志
  check('重复恢复无事可做', !journalApi.active());
}

console.log('流程 5：冲突处理口径（分享闸门依赖的未解决天数）');
{
  // 闸门口径：用 collab 状态模拟，无需 Vue（useShareGate 内部用的同一份 getters）
  const unresolved = collabApi.conflicts().filter((c) => c.trip_id === 'trip-1' && !c.resolved).map((c) => c.day_index);
  check('trip-1 仍有未解决冲突（第1天）', unresolved.includes(1));

  // 全部标记解决
  for (const c of collabApi.conflicts().filter((c) => c.trip_id === 'trip-1' && !c.resolved)) {
    collabApi.saveConflicts(collabApi.conflicts().map((x) => (x.id === c.id ? { ...x, resolved: true } : x)));
  }
  const left = collabApi.conflicts().filter((c) => c.trip_id === 'trip-1' && !c.resolved);
  check('trip-1 冲突全部处理完', left.length === 0);
}

console.log('\n全部通过：' + passed + ' 项断言');
