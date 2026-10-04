<template>
  <main class="page">
    <h1>行程编排 · 第 {{ dayIndex }} 天</h1>
    <div class="toolbar">
      <el-tag>当前操作者：{{ collabStore.author }}</el-tag>
      <el-tag type="info" size="small">计划 revision v{{ trip?.revision ?? 0 }}</el-tag>
      <el-tag type="success" size="small">目录 v{{ catalogStore.latestVersion }}</el-tag>
      <el-button size="small" @click="router.push('/trip/' + tripId)">返回详情</el-button>
    </div>

    <SaveRecoveryBar />
    <ConflictPanel
      :conflicts="collabStore.conflictsForTrip(tripId)"
      @accept-theirs="collabStore.acceptTheirs"
      @keep-mine="keepMine"
    />

    <el-alert v-if="day?.confirmed_version" type="success" :closable="false" show-icon style="margin: 12px 0">
      <template #title>
        这一天已确认（目录 v{{ day.confirmed_version }}），价格与分类已固定；要改请复制成新的一天，不能覆盖已确认安排。
      </template>
    </el-alert>

    <section class="band">
      <p class="muted">拖拽排序由 SortableJS 接管。已确认条目按固定价，未确认条目随目录最新版影响预算。</p>
      <div ref="listEl">
        <SpotMiniCard
          v-for="(entry, index) in resolvedItems"
          :key="entry.item.spot_id + '-' + index"
          :snapshot="entry.item.snapshot"
          :pinned="entry.item.pinned"
        />
      </div>
      <div class="toolbar">
        <el-button type="primary" :disabled="isConfirmed" @click="saveDraft">保存我的草稿（乐观锁提交）</el-button>
        <el-button type="success" :disabled="isConfirmed" @click="confirmDay">确认当天（固定目录价）</el-button>
        <el-checkbox v-model="faultDemo" size="small">演示：让本次保存停在「写入每日行程」这一步</el-checkbox>
      </div>
      <p class="muted">
        想模拟两个人先后保存：先用 A 保存/确认，再在右上角切换成 B，改一下顺序后保存，就会看到冲突；
        B 的草稿保留，已确认安排不被覆盖。
      </p>
    </section>
    <DayTimeline v-if="day" :day="day" :spots="catalogStore.spots" :versions="catalogStore.versions" :latest-version="catalogStore.latestVersion" />
  </main>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Sortable, { type SortableEvent } from 'sortablejs';
import { useSpotStore } from '../stores/spotStore';
import { useDayPlanStore } from '../stores/dayPlanStore';
import { useCatalogStore } from '../stores/catalogStore';
import { useTripStore } from '../stores/tripStore';
import { useCollabStore } from '../stores/collabStore';
import { useJournalStore } from '../stores/journalStore';
import SpotMiniCard from '../components/common/SpotMiniCard.vue';
import DayTimeline from '../components/common/DayTimeline.vue';
import SaveRecoveryBar from '../components/common/SaveRecoveryBar.vue';
import ConflictPanel from '../components/common/ConflictPanel.vue';
import { STORAGE_KEYS } from '../constants/storageVersion';
import { faultInject } from '../utils/storage';
import { JournalStatus } from '../constants/catalog';
import { resolveDay } from '../utils/versionResolver';
import { messages } from '../constants/messages';
import { toast } from '../utils/message';

const route = useRoute();
const router = useRouter();
const spotStore = useSpotStore();
const dayPlanStore = useDayPlanStore();
const catalogStore = useCatalogStore();
const tripStore = useTripStore();
const collabStore = useCollabStore();
const journalStore = useJournalStore();
const listEl = ref<HTMLElement>();
const faultDemo = ref(false);
const tripId = String(route.params.tripId);
const dayIndex = Number(route.params.dayIndex || 1);
const day = computed(() => dayPlanStore.ensureDay(tripId, dayIndex));
const isConfirmed = computed(() => dayPlanStore.isConfirmed(tripId, dayIndex));
const trip = computed(() => tripStore.trips.find((item) => item.id === tripId));
// 每条安排「按哪版算」：已确认固定价，未确认随目录最新版，已下架回退历史快照
const resolvedItems = computed(() =>
  resolveDay(day.value, catalogStore.spots, catalogStore.versions).map((item) => ({ item })),
);

onMounted(() => {
  tripStore.refresh();
  dayPlanStore.refresh();
  catalogStore.refresh();
  collabStore.refresh();
  journalStore.refresh();
  if (listEl.value) {
    new Sortable(listEl.value, {
      animation: 150,
      onEnd: (evt: SortableEvent) => dayPlanStore.reorder(tripId, dayIndex, evt.oldIndex || 0, evt.newIndex || 0),
    });
  }
});

function armFaultIfNeeded() {
  if (faultDemo.value) {
    faultInject.arm(STORAGE_KEYS.dayPlans);
    faultDemo.value = false;
  }
}

function saveDraft() {
  if (isConfirmed.value) {
    toast.fail(messages.cannotTouchConfirmed.replace('{day}', String(dayIndex)));
    return;
  }
  armFaultIfNeeded();
  const journal = dayPlanStore.saveDays(tripId, [day.value]);
  if (journal.status === JournalStatus.DONE) {
    tripStore.refresh();
    dayPlanStore.refresh();
    catalogStore.refresh();
  }
}

function confirmDay() {
  if (isConfirmed.value) return;
  armFaultIfNeeded();
  const journal = dayPlanStore.confirmDay(tripId, dayIndex);
  if (journal?.status === JournalStatus.DONE) {
    tripStore.refresh();
    dayPlanStore.refresh();
    catalogStore.refresh();
  }
}

function keepMine(conflictId: string) {
  const conflict = collabStore.keepMineDraft(conflictId);
  if (!conflict?.mine) return;
  const journal = dayPlanStore.saveDays(conflict.trip_id, [conflict.mine], { baseRevision: conflict.current_revision });
  if (journal.status === JournalStatus.DONE) {
    tripStore.refresh();
    dayPlanStore.refresh();
  }
}
</script>
