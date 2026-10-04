<template>
  <section class="band" :class="{ confirmed: Boolean(day.confirmed_version) }">
    <h3>
      第 {{ day.day_index }} 天 · {{ day.date }}
      <el-tag v-if="day.confirmed_version" type="success" size="small">已确认 · 目录 v{{ day.confirmed_version }} 固定价</el-tag>
      <el-tag v-else type="warning" size="small">未确认 · 随目录 v{{ latestVersion }} 重算</el-tag>
    </h3>
    <ol>
      <li v-for="item in resolved" :key="item.spot_id + item.start_time">
        <strong>{{ item.snapshot.name }}</strong>
        <span class="muted">
          {{ item.start_time }}-{{ item.end_time }} · {{ transportText[item.transport] }} · {{ item.note }}
        </span>
        <el-tag size="small" :type="item.pinned ? 'success' : 'info'">
          {{ spotCategoryText[item.snapshot.category] }} · {{ formatCurrency(item.snapshot.price) }}
          <template v-if="item.pinned">（确认时固定）</template>
        </el-tag>
      </li>
    </ol>
    <p v-if="!day.items.length" class="muted">这一天还没有安排。</p>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { DayPlan } from '../../models/dayPlan';
import type { Spot } from '../../models/spot';
import type { CatalogVersion } from '../../models/catalogVersion';
import { transportText, formatCurrency, spotCategoryText } from '../../utils/formatters';
import { resolveDay } from '../../utils/versionResolver';

const props = defineProps<{ day: DayPlan; spots: Spot[]; versions?: CatalogVersion[]; latestVersion?: number }>();
// 详情页 / 编排页 / 分享页共用同一套「按哪版算」规则
const resolved = computed(() => resolveDay(props.day, props.spots, props.versions ?? []));
</script>
<style scoped>
.confirmed { border-left: 4px solid #2d7a46; }
li { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
</style>
