<template>
  <section class="band day-timeline" :class="{ confirmed: Boolean(day.confirmed_at) }">
    <div class="day-head">
      <h3>第 {{ day.day_index }} 天 · {{ day.date }}</h3>
      <el-tag v-if="day.confirmed_at" type="success">已固定 v{{ day.confirmed_catalog_version }}</el-tag>
      <el-tag v-else type="warning">未确认 · 按目录 v{{ currentCatalogVersion }} 重算</el-tag>
    </div>
    <ol>
      <li v-for="(item, index) in day.items" :key="item.spot_id + item.start_time + index">
        <div class="item-line">
          <strong>{{ effectiveSpots[index]?.name || '未知景点' }}</strong>
          <el-tag size="small" :type="effectiveSpots[index]?.source === 'confirmed' ? 'success' : 'warning'">
            {{ categoryText(effectiveSpots[index]?.category) }} · {{ formatCurrency(effectiveSpots[index]?.price || 0) }}
            · v{{ effectiveSpots[index]?.catalogVersion || currentCatalogVersion }}
          </el-tag>
        </div>
        <span class="muted">{{ item.start_time }}-{{ item.end_time }} · {{ transportText[item.transport] }} · {{ item.note }}</span>
      </li>
    </ol>
    <p v-if="!day.items.length" class="muted">这一天还没有安排。</p>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { DayPlan } from '../../models/dayPlan';
import type { Spot } from '../../models/spot';
import { formatCurrency, spotCategoryText, transportText } from '../../utils/formatters';
import { effectiveSpotsForDay } from '../../utils/budgetCalculator';
const props = defineProps<{ day: DayPlan; spots: Spot[]; currentCatalogVersion?: number }>();
const effectiveSpots = computed(() => effectiveSpotsForDay(props.day, props.spots));
const categoryText = (category?: string) => spotCategoryText[category as keyof typeof spotCategoryText] || '未知分类';
</script>
<style scoped>
.day-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.day-timeline.confirmed { border-color: #67c23a; background: #f8fff4; }
.item-line { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
</style>
