import { defineStore } from 'pinia';
import type { SaveJournal } from '../models/journal';
import { JournalStatus } from '../constants/catalog';
import { journalApi } from '../api/journalApi';
import { runJournal } from '../utils/journalRunner';
import { messages } from '../constants/messages';
import { toast } from '../utils/message';

export const useJournalStore = defineStore('journal', {
  state: () => ({ active: journalApi.active() as SaveJournal | undefined }),
  getters: {
    // 存在跑到一半（非冲突）的日志：分享预览必须停住，等恢复
    interrupted(state): SaveJournal | undefined {
      return state.active?.status === JournalStatus.INTERRUPTED && state.active.completed < state.active.steps.length
        ? state.active
        : undefined;
    },
    // 卡在第一步冲突的日志
    blockedByConflict(state): SaveJournal | undefined {
      return state.active?.status === JournalStatus.CONFLICT ? state.active : undefined;
    },
    failedStep(state): SaveJournal['steps'][number] | undefined {
      const target = this.interrupted;
      return target?.steps.find((step) => step.error) || target?.steps[target.completed];
    },
  },
  actions: {
    refresh() {
      this.active = journalApi.active();
    },
    // 应用启动时自动发现未跑完的保存（例如上次写到一半就关了标签页）
    recoverOnBoot() {
      this.refresh();
      const target = this.active;
      if (target && target.status === JournalStatus.INTERRUPTED && target.completed < target.steps.length) {
        const step = target.steps[target.completed];
        toast.warn(messages.journalInterrupted.replace('{step}', step?.label || ''));
      }
    },
    // 从完整步骤恢复：已 done 的跳过，从断点那一步幂等重放
    resume() {
      const target = journalApi.active();
      if (!target) {
        toast.ok(messages.nothingToRecover);
        return;
      }
      const rerun = runJournal(target);
      this.refresh();
      if (rerun.status === JournalStatus.DONE) toast.ok(messages.resumeDone);
      else if (rerun.status === JournalStatus.CONFLICT) toast.fail(messages.journalConflictPause);
      return rerun;
    },
    // 冲突全部处理完后，把卡住的日志收尾
    closeConflictJournal() {
      const target = journalApi.active();
      if (target && target.status === JournalStatus.CONFLICT) {
        target.status = JournalStatus.DONE;
        target.updated_at = new Date().toISOString();
        journalApi.append(target);
        journalApi.clearActive();
      }
      this.refresh();
    },
  },
});
