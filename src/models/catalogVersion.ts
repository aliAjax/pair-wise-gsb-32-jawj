import { SpotCategory } from '../constants/spot';

// 目录某一版里被冻结下来的景点字段。
// 确认当天行程时把当时的价格与分类快照进 DayPlanItem，
// 之后目录再调价 / 改分类，已确认的详情、预算、分享单都按这里算，说得出按哪版算。
export interface SpotSnapshot {
  name: string;
  category: SpotCategory;
  price: number;
}

// 一版目录快照。版本号单调递增，只追加不改写，形成「可续作的目录版本」。
export interface CatalogVersion {
  version: number;
  created_at: string;
  // 这版改了什么，例如「西湖苏堤 调价 0 → 0」，详情页与分享页用它标注来源。
  note: string;
  // 该版本下的完整景点快照，key 为 spot_id；被替换 / 下架的景点不再出现。
  spots: Record<string, SpotSnapshot>;
}
