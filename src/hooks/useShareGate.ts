import { computed, unref, type MaybeRef } from 'vue';
import { useCollabStore } from '../stores/collabStore';
import { useJournalStore } from '../stores/journalStore';
import { messages } from '../constants/messages';

// 分享预览闸门：冲突没处理完，或上次保存还停在半路，分享单先停住并指出是哪几天。
export function useShareGate(tripIdRef: MaybeRef<string>) {
  const collabStore = useCollabStore();
  const journalStore = useJournalStore();

  const blockedDayIndexes = computed(() => collabStore.unresolvedDayIndexes(unref(tripIdRef)));
  const blockedByConflicts = computed(() => blockedDayIndexes.value.length > 0);
  const blockedByJournal = computed(() => Boolean(journalStore.interrupted));

  const blocked = computed(() => blockedByConflicts.value || blockedByJournal.value);

  const reason = computed(() => {
    if (blockedByConflicts.value) {
      const days = blockedDayIndexes.value.map((index) => `第 ${index} 天`).join('、');
      return messages.shareBlockedByConflicts
        .replace('{days}', String(blockedDayIndexes.value.length))
        .replace('{list}', days);
    }
    if (blockedByJournal.value) {
      return messages.shareBlockedByJournal.replace('{step}', journalStore.failedStep?.label || '未知步骤');
    }
    return '';
  });

  return { blocked, blockedByConflicts, blockedByJournal, blockedDayIndexes, reason };
}
