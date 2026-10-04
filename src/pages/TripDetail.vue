<template>
  <main class="page" v-if="trip">
    <TripHeader :trip="trip" />
    <el-alert
      v-if="pendingConflicts.length"
      type="error"
      show-icon
      :closable="false"
      title="分享预览已暂停"
      :description="'请先处理第 ' + conflictDays.join('、') + ' 天的协作冲突。'"
      class="conflict-alert"
    />
    <div class="toolbar">
      <el-button type="primary" @click="router.push('/spots?tripId=' + trip.id)">添加景点</el-button>
      <el-button @click="router.push('/planner/' + trip.id + '/1')">编排第 1 天</el-button>
      <el-button :type="pendingConflicts.length ? 'danger' : 'primary'" @click="router.push('/share?tripId=' + trip.id)">分享预览</el-button>
    </div>
    <section class="grid">
      <BudgetChart :spent="stats.value.budget.spent" :remaining="stats.value.budget.remaining" />
      <div class="band">
        <strong>统计</strong>
        <p>天数 {{ stats.value.days }} · 景点 {{ stats.value.spotCount }} · 目录 v{{ catalogStore.currentVersion }} · 计划 r{{ trip.revision }}</p>
        <p class="muted">{{ stats.value.budget.warning }}</p>
      </div>
    </section>
    <DayTimeline
      v-for="day in tripDays"
      :key="day.id"
      :day="day"
      :spots="catalogStore.spots"
      :current-catalog-version="catalogStore.currentVersion"
    />
    <div v-for="day in tripDays" :key="day.id + '-actions'" class="toolbar">
      <el-button size="small" :disabled="Boolean(day.confirmed_at)" @click="dayPlanStore.confirmDay(trip.id, day.day_index)">
        {{ day.confirmed_at ? '第 ' + day.day_index + ' 天已确认' : '确认第 ' + day.day_index + ' 天价格和分类' }}
      </el-button>
      <RouterLink :to="'/planner/' + trip.id + '/' + day.day_index">继续编排</RouterLink>
    </div>
  </main>
  <main v-else class="page"><EmptyState title="旅行不存在" /></main>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useTripStore } from '../stores/tripStore';
import { useCatalogStore } from '../stores/spotStore';
import { useDayPlanStore } from '../stores/dayPlanStore';
import { useTripStats } from '../hooks/useTripStats';
import TripHeader from '../components/common/TripHeader.vue';
import DayTimeline from '../components/common/DayTimeline.vue';
import BudgetChart from '../components/common/BudgetChart.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const router = useRouter();
const tripStore = useTripStore();
const catalogStore = useCatalogStore();
const dayPlanStore = useDayPlanStore();
const tripId = computed(() => String(route.params.id));
const trip = computed(() => tripStore.trips.find((item) => item.id === tripId.value));
const tripDays = computed(() => dayPlanStore.tripDays(tripId.value));
const pendingConflicts = computed(() => dayPlanStore.pendingConflicts(tripId.value));
const conflictDays = computed(() => dayPlanStore.conflictDays(tripId.value));
const stats = computed(() => trip.value ? useTripStats(trip.value, dayPlanStore.dayPlans, catalogStore.spots) : { value: { days: 0, spotCount: 0, budget: { spent: 0, remaining: 0, warning: '' } } });
</script>
<style scoped>.conflict-alert { margin-top: 16px; }</style>
