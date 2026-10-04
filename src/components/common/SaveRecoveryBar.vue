<template>
  <el-alert
    v-if="journalStore.interrupted"
    class="recovery-bar"
    type="error"
    :closable="false"
    show-icon
  >
    <template #title>
      上次保存写到一半失败了，停在「{{ journalStore.failedStep?.label }}」。完整步骤已保留，可从这一步恢复。
    </template>
    <div class="steps">
      <el-tag
        v-for="(step, index) in journalStore.interrupted.steps"
        :key="step.name"
        size="small"
        :type="step.done ? 'success' : index === journalStore.interrupted!.completed ? 'danger' : 'info'"
      >
        {{ index + 1 }}. {{ step.label }}{{ step.done ? ' ✓' : index === journalStore.interrupted!.completed ? ' ◀ 断点' : '' }}
      </el-tag>
    </div>
    <p v-if="journalStore.failedStep?.error" class="muted">失败原因：{{ journalStore.failedStep.error }}</p>
    <el-button type="primary" size="small" @click="resume">从完整步骤恢复</el-button>
  </el-alert>
  <el-alert
    v-else-if="journalStore.blockedByConflict"
    class="recovery-bar"
    type="warning"
    :closable="false"
    show-icon
    :title="messages.journalConflictPause"
  />
</template>
<script setup lang="ts">
import { useJournalStore } from '../../stores/journalStore';
import { messages } from '../../constants/messages';
const journalStore = useJournalStore();
function resume() {
  journalStore.resume();
}
</script>
<style scoped>
.recovery-bar { margin: 12px 0; }
.steps { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
</style>
