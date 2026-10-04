import { defineStore } from 'pinia';
import type { PlanConflict } from '../models/conflict';
import { collabApi, type TripDraft } from '../api/collabApi';
import { messages } from '../constants/messages';
import { toast } from '../utils/message';
import { useJournalStore } from './journalStore';

export const useCollabStore = defineStore('collab', {
  state: () => ({
    author: collabApi.author(),
    drafts: collabApi.drafts() as TripDraft[],
    conflicts: collabApi.conflicts() as PlanConflict[],
  }),
  getters: {
    conflictsForTrip: (state) => (tripId: string) => state.conflicts.filter((item) => item.trip_id === tripId),
    unresolved(state): PlanConflict[] {
      return state.conflicts.filter((item) => !item.resolved);
    },
    // 分享闸门：返回还有哪些天没处理完
    unresolvedDayIndexes: (state) => (tripId: string) =>
      state.conflicts.filter((item) => item.trip_id === tripId && !item.resolved).map((item) => item.day_index),
  },
  actions: {
    refresh() {
      this.author = collabApi.author();
      this.drafts = collabApi.drafts();
      this.conflicts = collabApi.conflicts();
    },
    setAuthor(author: string) {
      this.author = author;
      collabApi.saveAuthor(author);
    },
    markResolved(id: string) {
      const items = collabApi.conflicts().map((item) => (item.id === id ? { ...item, resolved: true } : item));
      collabApi.saveConflicts(items);
      this.refresh();
      toast.ok(messages.conflictResolved);
      // 该计划的冲突全部处理完，卡住的保存日志收尾，分享闸门解除
      const target = items.find((item) => item.id === id);
      if (target && !items.some((item) => item.trip_id === target.trip_id && !item.resolved)) {
        useJournalStore().closeConflictJournal();
      }
    },
    // 后到者放弃自己这一天的草稿，采用先到者版本；草稿仍保留在 drafts 里可回看
    acceptTheirs(id: string) {
      this.markResolved(id);
      toast.ok(messages.conflictAcceptedTheirs);
    },
    // 后到者保留自己的草稿：由调用方带着新的 base_revision 重新提交（见 Planner 页）
    keepMineDraft(id: string): PlanConflict | undefined {
      const conflict = this.conflicts.find((item) => item.id === id);
      if (conflict) this.markResolved(id);
      toast.ok(messages.conflictKeptMine);
      return conflict;
    },
  },
});
