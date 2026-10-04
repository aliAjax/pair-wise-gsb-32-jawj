<template>
  <main class="page">
    <template v-if="trip">
      <TripHeader :trip="trip" />
      <SaveRecoveryBar />

      <!-- 分享闸门：冲突没处理完或保存停在半路，预览先停住，并指出是哪几天 -->
      <el-result v-if="gate.blocked" icon="warning" title="分享预览已暂停" :sub-title="gate.reason">
            <template #extra>
              <div class="blocked-list">
                <el-tag v-for="d in gate.blockedDayIndexes" :key="d" type="danger" style="margin: 0 6px">
                  第 {{ d }} 天
                </el-tag>
              </div>
              <el-button v-if="gate.blockedByJournal" type="primary" @click="journalStore.resume()">从完整步骤恢复</el-button>
              <el-button v-else type="primary" @click="router.push('/trip/' + trip.id)">去处理冲突</el-button>
            </template>
          </el-result>

      <template v-else>
        <div class="toolbar">
          <el-tag type="success">分享单已按各天确认版本固定</el-tag>
          <CatalogVersionBadge :version="catalogStore.latestVersion" suffix="（目录最新版，未确认天按此计价）" />
          <el-button @click="copyText">复制行程文本</el-button>
        </div>
        <DayTimeline
          v-for="day in tripDays"
          :key="day.id"
          :day="day"
          :spots="catalogStore.spots"
          :versions="catalogStore.versions"
          :latest-version="catalogStore.latestVersion"
        />
        <section class="band" style="margin-top: 16px">
          <h3>预算口径（分享单固定说明）</h3>
          <p>合计 {{ formatCurrency(stats.budget.spent, trip.currency) }}；已确认天按确认当天目录价，未确认天按目录最新价。</p>
          <p class="muted">复制文本会写明每一条按哪一版目录算，发出去之后说得清。</p>
        </section>
      </template>
    </template>
    <main v-else class="page"><EmptyState title="旅行不存在" /></main>
  </main>
</template>
<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTripStore } from '../stores/tripStore';
import { useDayPlanStore } from '../stores/dayPlanStore';
import { useCatalogStore } from '../stores/catalogStore';
import { useJournalStore } from '../stores/journalStore';
import { useTripStats } from '../hooks/useTripStats';
import { useShareGate } from '../hooks/useShareGate';
import TripHeader from '../components/common/TripHeader.vue';
import DayTimeline from '../components/common/DayTimeline.vue';
import EmptyState from '../components/common/EmptyState.vue';
import SaveRecoveryBar from '../components/common/SaveRecoveryBar.vue';
import CatalogVersionBadge from '../components/common/CatalogVersionBadge.vue';
import { formatCurrency } from '../utils/formatters';
import { resolveDay } from '../utils/versionResolver';

const router = useRouter();
const tripStore = useTripStore();
const dayPlanStore = useDayPlanStore();
const catalogStore = useCatalogStore();
const journalStore = useJournalStore();

function refreshAll() {
  tripStore.refresh();
  dayPlanStore.refresh();
  catalogStore.refresh();
  journalStore.refresh();
}
onMounted(refreshAll);

const trip = computed(() => tripStore.trips[0]);
const tripDays = computed(() =>
  trip.value ? dayPlanStore.dayPlans.filter((day) => day.trip_id === trip.value!.id) : [],
);
const spotsRef = computed(() => catalogStore.spots);
const versionsRef = computed(() => catalogStore.versions);
const stats = useTripStats(trip, tripDays, spotsRef, versionsRef);

const gate = useShareGate(computed(() => trip.value?.id || ''));

function copyText() {
  if (!trip.value || gate.blocked.value) return;
  const lines: string[] = ['TripWeaver 行程单：' + trip.value.title];
  for (const day of tripDays.value) {
    lines.push(`第 ${day.day_index} 天（${day.confirmed_version ? '目录 v' + day.confirmed_version + ' 固定' : '未确认·目录 v' + catalogStore.latestVersion}）：`);
    for (const item of resolveDay(day, catalogStore.spots, catalogStore.versions)) {
      lines.push(`- ${item.snapshot.name} ${item.start_time}-${item.end_time} ${formatCurrency(item.snapshot.price)}${item.pinned ? '（确认时固定）' : ''}`);
    }
  }
  navigator.clipboard?.writeText(lines.join('\n'));
}
</script>
<style scoped>
.blocked-list { margin-bottom: 14px; }
</style>
