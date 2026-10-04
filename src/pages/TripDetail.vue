<template>
  <main class="page" v-if="trip">
    <TripHeader :trip="trip" />
    <SaveRecoveryBar />
    <div class="toolbar">
      <el-button type="primary" @click="router.push('/spots')">添加景点</el-button>
      <el-button @click="router.push('/planner/' + trip.id + '/1')">编排第 1 天</el-button>
      <el-button @click="router.push('/share')">分享预览</el-button>
      <CatalogVersionBadge :version="catalogStore.latestVersion" suffix="（当前）" />
      <el-tag type="info" size="small">计划版本 revision v{{ trip.revision }}</el-tag>
    </div>
    <section class="grid">
      <BudgetChart :spent="stats.budget.spent" :remaining="stats.budget.remaining" />
      <div class="band">
        <strong>统计</strong>
        <p>天数 {{ stats.days }} · 景点 {{ stats.spotCount }}</p>
        <p>已花 {{ formatCurrency(stats.budget.spent, trip.currency) }} / 预算 {{ formatCurrency(trip.budget, trip.currency) }}</p>
        <p class="muted">{{ stats.budget.warning || '已确认安排按确认时目录价，未确认安排随最新目录重算' }}</p>
      </div>
    </section>

    <ConflictPanel
      :conflicts="tripConflicts"
      @accept-theirs="collabStore.acceptTheirs"
      @keep-mine="keepMine"
    />

    <section v-for="day in tripDays" :key="day.id" style="margin-top: 14px">
      <DayTimeline :day="day" :spots="catalogStore.spots" :versions="catalogStore.versions" :latest-version="catalogStore.latestVersion" />
      <div class="toolbar" v-if="!day.confirmed_version">
        <el-button size="small" type="success" @click="confirm(day.day_index)">
          确认第 {{ day.day_index }} 天（固定当前目录 v{{ catalogStore.latestVersion }} 价格与分类）
        </el-button>
      </div>
      <p v-else class="muted">第 {{ day.day_index }} 天已于 {{ day.confirmed_at }} 确认，之后目录调价不影响这天。</p>
    </section>
  </main>
  <main v-else class="page"><EmptyState title="旅行不存在" /></main>
</template>
<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTripStore } from '../stores/tripStore';
import { useDayPlanStore } from '../stores/dayPlanStore';
import { useCatalogStore } from '../stores/catalogStore';
import { useCollabStore } from '../stores/collabStore';
import { useJournalStore } from '../stores/journalStore';
import { useTripStats } from '../hooks/useTripStats';
import TripHeader from '../components/common/TripHeader.vue';
import DayTimeline from '../components/common/DayTimeline.vue';
import BudgetChart from '../components/common/BudgetChart.vue';
import EmptyState from '../components/common/EmptyState.vue';
import SaveRecoveryBar from '../components/common/SaveRecoveryBar.vue';
import ConflictPanel from '../components/common/ConflictPanel.vue';
import CatalogVersionBadge from '../components/common/CatalogVersionBadge.vue';
import { formatCurrency } from '../utils/formatters';
import { JournalStatus } from '../constants/catalog';

const route = useRoute();
const router = useRouter();
const tripStore = useTripStore();
const dayPlanStore = useDayPlanStore();
const catalogStore = useCatalogStore();
const collabStore = useCollabStore();
const journalStore = useJournalStore();

const tripId = computed(() => String(route.params.id));
const trip = computed(() => tripStore.trips.find((item) => item.id === tripId.value));
const tripDays = computed(() => dayPlanStore.dayPlans.filter((day) => day.trip_id === tripId.value));
const spotsRef = computed(() => catalogStore.spots);
const versionsRef = computed(() => catalogStore.versions);

const stats = useTripStats(trip, tripDays, spotsRef, versionsRef);

const tripConflicts = computed(() => collabStore.conflictsForTrip(tripId.value));

onMounted(() => {
  tripStore.refresh();
  dayPlanStore.refresh();
  catalogStore.refresh();
  collabStore.refresh();
  journalStore.refresh();
});

function confirm(dayIndex: number) {
  const journal = dayPlanStore.confirmDay(tripId.value, dayIndex);
  if (journal?.status === JournalStatus.DONE) {
    catalogStore.refresh();
    tripStore.refresh();
  }
}

function keepMine(conflictId: string) {
  const conflict = collabStore.keepMineDraft(conflictId);
  if (!conflict?.mine) return;
  // 后到者保留自己的草稿，带着服务端最新 revision 重新提交；
  // 对方已确认的天按钮禁用，不会走到这里。
  const journal = dayPlanStore.saveDays(conflict.trip_id, [conflict.mine], { baseRevision: conflict.current_revision });
  if (journal.status === JournalStatus.DONE) {
    tripStore.refresh();
    dayPlanStore.refresh();
  }
}
</script>
