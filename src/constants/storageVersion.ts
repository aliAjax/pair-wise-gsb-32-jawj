export const STORAGE_VERSION = 'tripweaver-v1';
export const STORAGE_KEYS = {
  trips: STORAGE_VERSION + ':trips',
  spots: STORAGE_VERSION + ':spots',
  dayPlans: STORAGE_VERSION + ':dayPlans',
  theme: STORAGE_VERSION + ':theme',
  // 可续作的目录版本：只追加的版本快照
  catalogVersions: STORAGE_VERSION + ':catalog_versions',
  catalogLatest: STORAGE_VERSION + ':catalog_latest',
  // 两人先后保存时给后到者保留的草稿与冲突
  drafts: STORAGE_VERSION + ':drafts',
  conflicts: STORAGE_VERSION + ':conflicts',
  // 写到一半失败的完整步骤日志
  journals: STORAGE_VERSION + ':journals',
  activeJournal: STORAGE_VERSION + ':active_journal',
  // 当前操作者（模拟两个同行人 A / B 先后保存）
  currentAuthor: STORAGE_VERSION + ':current_author',
};
