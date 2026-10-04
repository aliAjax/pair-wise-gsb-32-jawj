# TripWeaver 旅游行程规划助手

## 快速启动

```bash
npm install
npm run dev
```

访问地址：http://localhost:18417

也可以使用 `pnpm install && pnpm dev`。

TripWeaver 是一款纯前端旅行规划应用，支持创建旅行、探索景点、编排每日行程、预算统计、协作冲突处理、可续作的景点目录版本和分享预览。

## 主要功能

- 我的旅行：创建、筛选、删除旅行计划，计划使用递增 revision 标识。
- 行程详情：查看每日行程、预算图表和共享时间线。
- 目录版本：景点调价或改分类时发布新版本；确认当天行程会固定当时价格和分类。
- 预算规则：已确认天数读取确认快照，未确认天数和预算始终按当前目录实时重算。
- 协作草稿：A/B 两个保存人各留草稿；后保存检测到并发或确认日保护时生成冲突，不会覆盖已确认安排。
- 冲突门禁：未处理完冲突时，分享预览暂停并明确提示冲突日期。
- 替换景点：清理未确认安排和草稿中的旧引用，已确认快照继续保留历史依据。
- 可恢复保存：每日安排、冲突、计划版本、草稿分步写入；写一半失败后启动时按完整步骤恢复。
- 景点探索：按 SpotCategory 搜索和筛选，收藏并加入行程。
- 行程编排：SortableJS 拖拽排序，实时影响预算计算。
- 分享预览：生成可复制的行程文本和预算汇总。

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
├── api/
│   ├── catalogVersionApi.ts
│   ├── conflictApi.ts
│   ├── dayPlanApi.ts
│   ├── draftApi.ts
│   ├── saveJournalApi.ts
│   ├── spotApi.ts
│   └── tripApi.ts
├── stores/
│   ├── catalogStore.ts
│   ├── dayPlanStore.ts
│   ├── themeStore.ts
│   └── tripStore.ts
├── models/
│   ├── catalogVersion.ts
│   ├── conflict.ts
│   ├── dayPlan.ts
│   ├── draft.ts
│   ├── saveJournal.ts
│   ├── spot.ts
│   └── trip.ts
├── types/
├── components/common/
│   ├── BudgetChart.vue
│   ├── CategoryFilter.vue
│   ├── CollabPanel.vue
│   ├── DayTimeline.vue
│   ├── EmptyState.vue
│   ├── GlobalErrorBoundary.tsx
│   ├── SpotCard.vue
│   ├── SpotMiniCard.vue
│   ├── TripCard.vue
│   └── TripHeader.vue
├── hooks/
├── pages/
│   ├── Planner.vue
│   ├── Share.vue
│   ├── Spots.vue
│   ├── TripDetail.vue
│   └── Trips.vue
├── router/
├── utils/
│   ├── budgetCalculator.ts
│   ├── catalog.ts
│   ├── formatters.ts
│   ├── persistence.ts
│   ├── storage.ts
│   └── validators.ts
├── config/
├── constants/
└── App.vue
```

严禁合并职责到单一文件：目录版本、协作冲突、保存日志、模型、API、store 和展示组件分层维护。

## 数据持久化

本地数据通过 `utils/storage.ts` 统一写入 localStorage，版本键来自 `constants/storageVersion.ts`，当前为 `tripweaver-v2`。

- `catalog-versions`：景点目录版本链。
- `dayPlans`：每日安排；确认日的 item 保存 SpotSnapshot。
- `drafts`：按旅行和保存人隔离的协作草稿。
- `conflicts`：未处理或已解决的日期级冲突。
- `save-journals`：分步保存日志，失败后可恢复完整 desired state。

Dexie 数据库对象保留在 `TripWeaverDb` 中，用于后续 IndexedDB 扩展。

## 版本、冲突与恢复语义

1. 在旅行详情页点击“确认第 N 天价格和分类”，系统把当天所有景点的价格、分类和目录版本写入快照。
2. 之后目录调价或改分类：
   - 已确认日：详情、预算、分享继续使用快照，能说清按哪一版。
   - 未确认日：直接读取当前目录并自动重算预算。
3. 两名保存人基于同一 revision 先后保存：后到者的草稿保留，冲突面板列出具体天数；可选择“保留我的草稿”或“采用已保存安排”。
4. 已确认日期不能被后到草稿覆盖，只允许采用已保存安排。
5. 仍有 pending 冲突时，分享页不渲染行程正文和复制结果，只显示被阻塞的日期。
6. 编排页可模拟在任一步骤后写入失败；重新加载应用会读取 save journal，按每日安排、冲突、计划版本、草稿的完整步骤恢复。

## 环境变量

`VITE_AMAP_KEY`：高德地图 key。未配置时使用 demo-key，地图主题配置同时出现在 `config/map.ts`、`SpotCard`、`DayTimeline`、`Planner` 相关逻辑中。

## 构建生产包

```bash
npm run build
npm run preview
```

将 `dist/` 目录交给 Nginx 或任意静态文件服务器托管即可。

## 枚举出现位置清单

SpotCategory：
- `src/constants/spot.ts`
- `src/models/spot.ts`
- `src/models/dayPlan.ts`
- `src/stores/catalogStore.ts`
- `src/components/common/CategoryFilter.vue`
- `src/components/common/SpotCard.vue`
- `src/components/common/DayTimeline.vue`
- `src/pages/Spots.vue`
- `src/pages/TripDetail.vue`
- `src/types/index.ts`
- `src/utils/formatters.ts`
- `src/utils/catalog.ts`
- `src/utils/budgetCalculator.ts`

TripStatus：
- `src/constants/trip.ts`
- `src/models/trip.ts`
- `src/stores/tripStore.ts`
- `src/components/common/TripCard.vue`
- `src/pages/Trips.vue`
- `src/utils/formatters.ts`
- `src/router/guards.ts`

## License

MIT
