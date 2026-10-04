<template>
  <main class="page">
    <div class="toolbar">
      <el-select v-model="tripId" style="width: 240px">
        <el-option v-for="trip in tripStore.trips" :key="trip.id" :label="trip.title" :value="trip.id" />
      </el-select>
      <el-tag>目录 v{{ catalogStore.currentVersion }}</el-tag>
    </div>

    <template v-if="trip">
      <el-alert
        v-if="pendingConflicts.length"
        type="error"
        show-icon
        :closable="false"
        title="分享预览已暂停"
        class="blocked-alert"
      >
        <p>请先处理以下日期的冲突：第 {{ conflictDays.join('、') }} 天。</p>
        <el-button type="primary" size="small" @click="router.push('/trip/' + trip.id)">返回处理冲突</el-button>
      </el-alert>

      <template v-else>
        <TripHeader :trip="trip" />
        <p class="muted">
          已确认日期固定确认时价格与分类；未确认日期按目录 v{{ catalogStore.currentVersion }} 实时计入预算。
        </p>
        <DayTimeline
          v-for="day in tripDays"
          :key="day.id"
          :day="day"
          :spots="catalogStore.spots"
          :current-catalog-version="catalogStore.currentVersion"
        />
        <div class="band total-band">
          <strong>预算汇总</strong>
          <p>已计划 {{ formatCurrency(stats.spent, trip.currency) }} / {{ formatCurrency(trip.budget, trip.currency) }}</p>
          <p class="muted">{{ stats.warning || '预算仍在范围内' }}</p>
        </div>
        <el-button type="primary" @click="copyText">复制行程文本</el-button>
      </template>
    </template>
    <EmptyState v-else title="请选择旅行计划" />
  </main>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTripStore } from '../stores/tripStore';
import { useCatalogStore } from '../stores/spotStore';
import { useDayPlanStore } from '../stores/dayPlanStore';
import TripHeader from '../components/common/TripHeader.vue';
import DayTimeline from '../components/common/DayTimeline.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { formatCurrency } from '../utils/formatters';
import { budgetStatus } from '../utils/budgetCalculator';

const route = useRoute();
const router = useRouter();
const tripStore = useTripStore();
const catalogStore = useCatalogStore();
const dayPlanStore = useDayPlanStore();
const queryTripId = typeof route.query.tripId === 'string' ? route.query.tripId : '';
const tripId = ref(queryTripId || tripStore.trips[0]?.id || '');
watch(() => route.query.tripId, (value) => { if (typeof value === 'string') tripId.value = value; });
const trip = computed(() => tripStore.trips.find((item) => item.id === tripId.value));
const tripDays = computed(() => dayPlanStore.tripDays(tripId.value));
const pendingConflicts = computed(() => dayPlanStore.pendingConflicts(tripId.value));
const conflictDays = computed(() => dayPlanStore.conflictDays(tripId.value));
const stats = computed(() => trip.value ? budgetStatus(trip.value, tripDays.value, catalogStore.spots) : { spent: 0, remaining: 0, warning: '' });
function copyText() {
  if (!trip.value || pendingConflicts.value.length) return;
  navigator.clipboard?.writeText(`TripWeaver 行程单：${trip.value.title}，目录 v${catalogStore.currentVersion}，共 ${tripDays.value.length} 天`);
}
</script>
<style scoped>
.blocked-alert { margin: 20px 0; }
.total-band { margin: 16px 0; }
</style>
