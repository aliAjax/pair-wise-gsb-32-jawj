# TripWeaver 旅游行程规划助手

## 快速启动

```bash
pnpm install
pnpm dev
```

访问地址：http://localhost:18417

构建生产包：

```bash
pnpm build
```

TripWeaver 是一款纯前端旅行规划应用，支持创建旅行、探索景点、编排每日行程、预算统计和分享预览。
**目录带可续作的版本**：确认当天行程会固定当时的景点价格与分类，目录再调价 / 改分类也不影响已确认安排；未确认安排和预算始终按目录最新版重算。

## 主要功能

- 我的旅行：创建、筛选、删除旅行计划。
- 行程详情：查看每日行程、预算图表、按天确认（固定目录版本）、处理并发冲突。
- 景点探索：按 SpotCategory 搜索和筛选，收藏并加入行程；**目录调价 / 改分类会发布新版本，替换景点会清掉未确认行程的旧引用**。
- 行程编排：SortableJS 拖拽排序、保存草稿（乐观锁）、确认当天、模拟两个人先后保存与「写到一半失败后恢复」。
- 分享预览：**冲突没处理完或保存停在半路时预览先停住，并指出是哪几天**；通过后按各天确认版本生成可复制行程文本。

## 目录版本 / 并发保存 / 可恢复保存（核心机制）

1. **可续作的目录版本（CatalogVersion）**
   - 每次调价、改分类、替换景点都追加一版完整快照（`src/models/catalogVersion.ts`，只追加不改写）。
   - 确认当天行程时，把当时的目录版本号与每个景点的 `price / category` 快照冻结进 `DayPlanItem.frozen`。
   - 「按哪版算」的唯一入口是 `src/utils/versionResolver.ts`，被 `DayTimeline`、预算计算、分享单共用：
     已确认条目用冻结价，未确认条目跟随最新目录，被替换 / 下架的景点回退到历史快照。

2. **两个人先后保存（乐观锁 + 冲突保留）**
   - Trip 带 `revision`，保存时第一步校验版本、第二步保护已确认天（`src/utils/journalRunner.ts`）。
   - 后到者拿旧 revision 提交：自己的草稿完整保留在 `collabApi`，并按天生成 `PlanConflict`；先到者已确认的安排绝不被覆盖。
   - 已确认天的冲突只能「采用先到者版本」；普通天可「保留我的草稿并重提」（带最新 revision 重新提交）。

3. **替换景点清理旧引用**
   - 目录替换在事务的 `PURGE_REFS` 步把**未确认**行程里的旧 `spot_id` 清掉；已确认安排靠 `frozen` 快照继续可读、可计价。

4. **保存写到一半失败 → 从完整步骤恢复（WAL）**
   - 每次保存先落一份完整步骤日志（`src/models/journal.ts`），再逐步执行，每步完成都更新断点。
   - 写失败停在某一步并保留错误信息（`SaveRecoveryBar` 会点名断点），刷新或点「从完整步骤恢复」即可从断点幂等重放。
   - 故障可在「景点探索 / 行程编排」页勾选演示开关复现（`src/utils/storage.ts` 的 `faultInject`）。

5. **分享闸门（useShareGate）**
   - 存在未解决冲突 → 分享预览停住，列出「第 X 天、第 Y 天」；
   - 存在中断的保存日志 → 预览停住，提示先从完整步骤恢复。

### 核心流程冒烟测试

`scripts/smoke.ts`（不进前端构建）用内存 localStorage 桩覆盖上述机制，共 32 项断言：

```bash
node -e "const e=require('node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild');e.buildSync({entryPoints:['scripts/smoke.ts'],bundle:true,platform:'node',format:'esm',outfile:'scripts/smoke.mjs'})"
node scripts/smoke.mjs
```

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 前端 | Vue 3 + TypeScript |
| 构建 | Vite |
| UI | Element Plus + ECharts |
| 状态 | Pinia |
| 路由 | Vue Router 4 |
| 持久化 | localStorage + Dexie.js |
| 交互 | sortablejs |

## 项目目录结构

```
src/
├── api/              # tripApi, spotApi, dayPlanApi, catalogApi, collabApi, journalApi
├── stores/           # tripStore, spotStore, dayPlanStore, themeStore, catalogStore, collabStore, journalStore
├── models/           # trip.ts, spot.ts, dayPlan.ts, catalogVersion.ts, conflict.ts, journal.ts
├── types/
├── components/common/# TripCard, SpotCard, DayTimeline, CategoryFilter, SpotMiniCard,
│                     # BudgetChart, TripHeader, EmptyState, ConflictPanel, SaveRecoveryBar, CatalogVersionBadge
├── hooks/            # useTripStats, useLocalStorage, useMapSpots, useShareGate
├── pages/            # Trips, TripDetail, Spots, Planner, Share
├── router/
├── utils/            # storage, budgetCalculator, versionResolver, journalRunner, formatters, validators
├── config/
└── constants/        # spot, trip, catalog, themes, messages, storageVersion
```

## 数据持久化

- 本地数据通过 `utils/storage.ts` 统一写入 localStorage，并保留 Dexie 数据库对象（v2 schema 含 `catalogVersions`、`saveJournals` 表）用于 IndexedDB 扩展。
- 版本键来自 `constants/storageVersion.ts`；目录版本、草稿、冲突、保存日志各有独立键。

## 环境变量

`VITE_AMAP_KEY`：高德地图 key。未配置时使用 demo-key，地图主题配置同时出现在 `config/map.ts`、`SpotCard`、`DayTimeline`、`Planner` 相关逻辑中。

## 枚举出现位置清单

SpotCategory：
- `src/constants/spot.ts`
- `src/models/spot.ts`
- `src/models/catalogVersion.ts`（冻结快照里的分类）
- `src/stores/spotStore.ts`
- `src/components/common/CategoryFilter.vue`
- `src/components/common/SpotCard.vue`
- `src/components/common/DayTimeline.vue`
- `src/pages/Spots.vue`
- `src/pages/TripDetail.vue`
- `src/utils/formatters.ts`
- `src/utils/versionResolver.ts`
- `src/api/catalogApi.ts`
- `src/router/guards.ts`

TripStatus：
- `src/constants/trip.ts`
- `src/models/trip.ts`
- `src/stores/tripStore.ts`
- `src/components/common/TripCard.vue`
- `src/pages/Trips.vue`
- `src/utils/formatters.ts`
- `src/router/guards.ts`

新增版本 / 事务相关枚举（SaveKind、JournalStatus、PlanStep、CatalogStep、ConflictType）集中定义在：
- `src/constants/catalog.ts`，并被 `utils/journalRunner.ts`、`stores/journalStore.ts`、`stores/collabStore.ts`、`components/common/SaveRecoveryBar.vue`、`components/common/ConflictPanel.vue`、`hooks/useShareGate.ts` 共同引用。

## License

MIT
