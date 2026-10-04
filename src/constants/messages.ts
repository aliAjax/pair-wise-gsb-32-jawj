export const messages = {
  tripCreated: '旅行计划已创建',
  tripDeleted: '旅行计划已删除',
  spotAdded: '景点已加入当天行程（未确认草稿，按目录最新版计价）',
  emptyTrips: '还没有旅行计划，先创建一次出发。',
  emptySpots: '没有符合条件的景点。',
  budgetExceeded: '预算可能超支，请调整景点或交通方式',
  storageRecovered: '本地数据已恢复',
  // 目录版本
  catalogAmended: '目录已发布新版本，未确认安排和预算已按新版重算；已确认安排保持确认时的价格和分类',
  catalogReplace: '景点已替换，未确认行程里的旧引用已清理；已确认安排保留当时快照',
  dayConfirmed: '当天行程已确认：价格与分类已按目录第 {version} 版固定',
  // 并发保存
  conflictFound: '发现并发保存：已为你保留草稿，先到者已确认的安排没有被覆盖',
  conflictKeptMine: '已保留你的草稿并重新提交，请处理后再保存其余几天',
  conflictAcceptedTheirs: '已采用先到者版本，你的草稿保存在冲突记录里可回看',
  conflictResolved: '该天冲突已处理',
  cannotTouchConfirmed: '第 {day} 天已确认，不能被后来者覆盖',
  nothingToRecover: '没有需要恢复的保存步骤',
  // 恢复
  journalRecovered: '上次保存写到一半，已从完整步骤恢复完成',
  journalInterrupted: '保存停在「{step}」，可从这一步继续恢复',
  journalConflictPause: '保存因冲突停在第一步，处理冲突后才能继续',
  resumeDone: '恢复完成：本次保存的全部步骤已跑完',
  // 分享闸门
  shareBlockedByConflicts: '分享预览已暂停：还有 {days} 天的冲突没有处理完（{list}），处理后再生成分享单',
  shareBlockedByJournal: '分享预览已暂停：上次保存停在「{step}」，请先从完整步骤恢复',
};
