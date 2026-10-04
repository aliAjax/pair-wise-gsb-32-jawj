<template>
  <section class="band collab-panel">
    <div class="panel-head">
      <strong>协作草稿</strong>
      <el-tag>当前保存人：{{ editor }}</el-tag>
    </div>
    <p class="muted">
      基础版本 r{{ draft?.base_revision || '-' }} ·
      草稿目录 v{{ draft?.catalog_version || '-' }} ·
      未处理冲突 {{ pending.length }} 个
    </p>

    <el-alert
      v-for="conflict in pending"
      :key="conflict.id"
      class="conflict"
      type="warning"
      :closable="false"
      show-icon
    >
      <template #title>
        第 {{ conflict.day_index }} 天（{{ conflict.date }}）冲突：
        {{ conflict.reason === 'confirmed-protected' ? '当天已确认，不能覆盖' : '另一个人已先保存' }}
      </template>
      <div class="toolbar">
        <el-button
          size="small"
          type="primary"
          :disabled="conflict.reason === 'confirmed-protected'"
          @click="store.resolveConflict(conflict.id, 'keep-mine')"
        >保留我的草稿</el-button>
        <el-button size="small" @click="store.resolveConflict(conflict.id, 'take-theirs')">采用已保存安排</el-button>
      </div>
    </el-alert>

    <div class="toolbar">
      <el-select v-model="failAfter" size="small" style="width: 190px" placeholder="正常保存">
        <el-option label="正常保存" value="" />
        <el-option v-for="step in steps" :key="step.key" :label="'模拟在 ' + step.label + ' 后中断'" :value="step.key" />
      </el-select>
      <el-button size="small" type="primary" @click="save">保存草稿</el-button>
      <el-button size="small" @click="discard">丢弃草稿</el-button>
    </div>
    <p class="muted">保存会依次写入每日安排、冲突、计划版本和个人草稿；中断后可从完整步骤恢复。</p>
  </section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import type { SaveConflict } from '../../models/conflict';
import type { SaveJournal } from '../../models/saveJournal';
import type { TripDraft } from '../../models/draft';
import { useDayPlanStore } from '../../stores/dayPlanStore';
import { messages } from '../../constants/messages';
import { clearStorageFailure } from '../../utils/storage';
import { toast } from '../../utils/message';

const props = defineProps<{
  tripId: string;
  editor: string;
  draft?: TripDraft;
  pending: SaveConflict[];
}>();
const store = useDayPlanStore();
const failAfter = ref<SaveJournal['failedAfterStep'] | ''>('');
const steps = [
  { key: 'days', label: '写入每日安排' },
  { key: 'conflicts', label: '登记冲突日期' },
  { key: 'trips', label: '推进计划版本' },
];
async function save() {
  try {
    await store.saveDraft(props.tripId, props.editor, failAfter.value || undefined);
    failAfter.value = '';
  } catch {
    clearStorageFailure();
    toast.warn(messages.storageWriteInterrupted);
  }
}
function discard() {
  store.discardDraft(props.tripId, props.editor);
}
</script>
<style scoped>
.collab-panel { border-color: #d6b65f; }
.panel-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.conflict { margin: 12px 0; }
</style>
