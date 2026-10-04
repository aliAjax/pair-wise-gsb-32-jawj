<template>
  <div class="mini">
    <span>
      {{ display.name }}
      <el-tag v-if="pinned" size="small" type="success">固定价</el-tag>
    </span>
    <span>{{ formatCurrency(display.price) }}</span>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { Spot } from '../../models/spot';
import type { SpotSnapshot } from '../../models/catalogVersion';
import { formatCurrency } from '../../utils/formatters';

// 编排页对已确认 / 已下架景点用 snapshot 口径，其余直接用 Spot
const props = defineProps<{ spot?: Spot; snapshot?: SpotSnapshot; pinned?: boolean }>();
const display = computed(() => {
  if (props.snapshot) return { name: props.snapshot.name, price: props.snapshot.price };
  return { name: props.spot?.name || '未知景点', price: props.spot?.price || 0 };
});
</script>
<style scoped>
.mini { display: flex; justify-content: space-between; padding: 10px 12px; border: 1px dashed #a8b8a1; border-radius: 8px; margin-bottom: 8px; background: #fff; }
</style>
