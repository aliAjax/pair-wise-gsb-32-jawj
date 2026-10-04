<template>
  <main class="page">
    <h1>行程编排</h1>
    <div class="toolbar">
      <el-select v-model="tripId" style="width: 220px">
        <el-option v-for="trip in tripStore.trips" :key="trip.id" :label="trip.title" :value="trip.id" />
      </el-select>
      <el-select v-model="dayIndex" style="width: 120px">
        <el-option v-for="number in 3" :key="number" :label="'第 ' + number + ' 天'" :value="number" />
      </el-select>
      <el-select v-model="editor" style="width: 160px">
        <el-option label="保存人 A" value="A" />
        <el-option label="保存人 B" value="B" />
      </el-select>
      <el-button @click="loadDraft">载入我的草稿</el-button>
    </div>

    <CollabPanel :trip-id="tripId" :editor="editor" :draft="draft" :pending="pendingConflicts" />

    <section class="band" v-if="draft && draftDay">
      <div class="toolbar">
        <h3>第 {{ dayIndex }} 天 · {{ draftDay.date }}</h3>
        <el-select v-model="selectedSpotId" size="small" style="width: 220px">
          <el-option v-for="spot in catalogStore.spots" :key="spot.id" :label="spot.name + ' · ' + spot.price + '元'" :value="spot.id" />
        </el-select>
        <el-button size="small" type="primary" :disabled="Boolean(draftDay.confirmed_at)" @click="addSelectedSpot">加入草稿</el-button>
      </div>
      <p class="muted">拖拽排序与替换只改当前保存人的草稿；已确认日期保持固定。</p>
      <div ref="listEl" class="draft-list">
        <article v-for="item in draftDay.items" :key="item.id" :data-id="item.id" class="draft-item">
          <div>
            <strong>{{ spotById.get(item.spot_id)?.name || item.spot_id }}</strong>
            <p class="muted">{{ formatCurrency(spotById.get(item.spot_id)?.price || 0) }} · {{ item.start_time }}-{{ item.end_time }}</p>
          </div>
          <el-select
            size="small"
            :model-value="item.spot_id"
            :disabled="Boolean(draftDay.confirmed_at)"
            style="width: 190px"
            @change="(value: string | number | boolean) => replaceSpot(item.id, String(value))"
          >
            <el-option v-for="spot in catalogStore.spots" :key="spot.id" :label="'换成 ' + spot.name" :value="spot.id" />
          </el-select>
        </article>
      </div>
    </section>

    <DayTimeline v-if="draftDay" :day="draftDay" :spots="catalogStore.spots" :current-catalog-version="catalogStore.currentVersion" />
  </main>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Sortable, { type SortableEvent } from 'sortablejs';
import { useCatalogStore } from '../stores/spotStore';
import { useTripStore } from '../stores/tripStore';
import { useDayPlanStore } from '../stores/dayPlanStore';
import CollabPanel from '../components/common/CollabPanel.vue';
import DayTimeline from '../components/common/DayTimeline.vue';
import { formatCurrency } from '../utils/formatters';

const route = useRoute();
const routeTripId = String(route.params.tripId || '');
const routeDayIndex = Number(route.params.dayIndex || 1);
const tripStore = useTripStore();
const catalogStore = useCatalogStore();
const dayPlanStore = useDayPlanStore();
const tripId = ref(routeTripId || tripStore.trips[0]?.id || '');
const dayIndex = ref(routeDayIndex || 1);
const editor = ref('A');
const selectedSpotId = ref(catalogStore.spots[0]?.id || '');
const listEl = ref<HTMLElement>();
let sortable: Sortable | null = null;

const draft = computed(() => dayPlanStore.getDraft(tripId.value, editor.value));
const draftDay = computed(() => draft.value?.days.find((day) => day.day_index === dayIndex.value));
const pendingConflicts = computed(() => dayPlanStore.pendingConflicts(tripId.value).filter((conflict) => conflict.editor === editor.value));
const spotById = computed(() => new Map<string, { name: string; price: number }>(catalogStore.spots.map((spot) => [spot.id, spot])));

function loadDraft() {
  if (!tripId.value) tripId.value = tripStore.trips[0]?.id || tripStore.createTrip();
  dayPlanStore.loadDraft(tripId.value, editor.value);
}
function addSelectedSpot() {
  dayPlanStore.addSpotToDraft(tripId.value, editor.value, selectedSpotId.value, dayIndex.value);
}
function replaceSpot(itemId: string, nextSpotId: string) {
  const index = draftDay.value?.items.findIndex((item) => item.id === itemId) ?? -1;
  if (index >= 0) dayPlanStore.replaceSpotInDraft(tripId.value, editor.value, dayIndex.value, index, nextSpotId);
}
async function bindSortable() {
  await nextTick();
  sortable?.destroy();
  sortable = null;
  if (listEl.value && !draftDay.value?.confirmed_at) {
    sortable = new Sortable(listEl.value, {
      animation: 150,
      onEnd: (event: SortableEvent) => dayPlanStore.reorderDraft(tripId.value, editor.value, dayIndex.value, event.oldIndex || 0, event.newIndex || 0),
    });
  }
}
watch([tripId, editor], loadDraft, { immediate: true });
watch(draftDay, bindSortable);
onMounted(bindSortable);
</script>
<style scoped>
.draft-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; border: 1px dashed #a8b8a1; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; background: #fff; }
</style>
