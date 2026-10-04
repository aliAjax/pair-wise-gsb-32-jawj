<template>
  <section v-if="conflicts.length" class="band conflict-panel">
    <h3>并发保存冲突（{{ conflicts.length }}）</h3>
    <p class="muted">两个人先后保存了同一计划。你的草稿已保留，先到者已确认的安排没有被覆盖。</p>
    <el-card v-for="conflict in visibleConflicts" :key="conflict.id" class="conflict-card" shadow="never">
      <header>
        <strong>第 {{ conflict.day_index }} 天</strong>
        <el-tag size="small" :type="conflict.type === ConflictType.CONFIRMED_DAY ? 'danger' : 'warning'">
          {{ conflict.type === ConflictType.CONFIRMED_DAY ? '对方已确认，不可覆盖' : '版本落后' }}
        </el-tag>
        <el-tag v-if="conflict.resolved" size="small" type="success">已处理</el-tag>
      </header>
      <div class="compare">
        <div class="side">
          <p class="muted">你的草稿（{{ conflict.author }}，基于 v{{ conflict.base_revision }}）</p>
          <p v-for="item in conflict.mine?.items || []" :key="item.spot_id + item.start_time">
            {{ item.spot_id }} · {{ item.start_time }}-{{ item.end_time }}
          </p>
          <p v-if="!conflict.mine?.items.length" class="muted">空</p>
        </div>
        <div class="side">
          <p class="muted">先到者已保存（当前 v{{ conflict.current_revision }}）</p>
          <p v-for="item in conflict.theirs?.items || []" :key="item.spot_id + item.start_time">
            {{ item.spot_id }} · {{ item.start_time }}-{{ item.end_time }}
            <el-tag v-if="item.frozen" size="small" type="success">已确认固定价</el-tag>
          </p>
          <p v-if="!conflict.theirs?.items.length" class="muted">空</p>
        </div>
      </div>
      <div v-if="!conflict.resolved" class="toolbar">
        <el-button size="small" @click="$emit('accept-theirs', conflict.id)">采用先到者版本</el-button>
        <el-button
          size="small"
          type="primary"
          :disabled="conflict.type === ConflictType.CONFIRMED_DAY"
          @click="$emit('keep-mine', conflict.id)"
        >
          保留我的草稿并重提
        </el-button>
        <el-tag v-if="conflict.type === ConflictType.CONFIRMED_DAY" size="small" type="danger">
          该天已确认，只能采用对方版本
        </el-tag>
      </div>
    </el-card>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { PlanConflict } from '../../models/conflict';
import { ConflictType } from '../../constants/catalog';

const props = defineProps<{ conflicts: PlanConflict[] }>();
defineEmits<{ 'accept-theirs': [id: string]; 'keep-mine': [id: string] }>();

const visibleConflicts = computed(() => props.conflicts);
</script>
<style scoped>
.conflict-panel { border-left: 4px solid #e6a23c; }
.conflict-card { margin: 10px 0; }
.compare { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 8px 0; }
.side { background: #faf8f0; border-radius: 6px; padding: 8px 12px; }
</style>
