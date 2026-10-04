<template>
  <main class="page">
    <h1>景点探索</h1>
    <section class="band catalog-panel">
      <div class="toolbar">
        <strong>目录版本</strong>
        <el-tag>当前 v{{ spotStore.currentVersion }}</el-tag>
        <span class="muted">调价或改分类后发布新版本；已确认日期继续读取确认时快照。</span>
      </div>
      <div v-for="spot in editSpots" :key="spot.id" class="catalog-row">
        <strong>{{ spot.name }}</strong>
        <el-input-number v-model="spot.price" :min="0" :step="10" size="small" />
        <el-select v-model="spot.category" size="small" style="width: 150px">
          <el-option v-for="item in SPOT_CATEGORY_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </div>
      <el-button type="primary" size="small" @click="publishChanges">发布目录新版本</el-button>
    </section>
    <div class="toolbar">
      <el-input v-model="spotStore.keyword" placeholder="搜索景点、标签" style="max-width: 260px" />
      <CategoryFilter v-model="categoryFilter" />
    </div>
    <EmptyState v-if="!filteredSpots.length" title="没有景点" :description="messages.emptySpots" />
    <section class="grid">
      <SpotCard
        v-for="spot in filteredSpots"
        :key="spot.id"
        :spot="spot"
        @favorite="spotStore.toggleFavorite"
        @add="addSpot"
        @replace="replaceReference"
      />
    </section>
  </main>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useTripStore } from '../stores/tripStore';
import { useSpotStore } from '../stores/spotStore';
import { useDayPlanStore } from '../stores/dayPlanStore';
import CategoryFilter from '../components/common/CategoryFilter.vue';
import SpotCard from '../components/common/SpotCard.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { SPOT_CATEGORY_OPTIONS, SpotCategory } from '../constants/spot';
import { messages } from '../constants/messages';
import { cloneData } from '../utils/catalog';

const route = useRoute();
const tripStore = useTripStore();
const spotStore = useSpotStore();
const dayPlanStore = useDayPlanStore();
const categoryFilter = ref('all');
const editSpots = ref(cloneData(spotStore.spots));
const filteredSpots = computed(() => spotStore.spots.filter((spot) => {
  const keyword = spotStore.keyword;
  const matchKeyword = !keyword || spot.name.includes(keyword) || spot.tags.some((tag) => tag.includes(keyword));
  const matchCategory = categoryFilter.value === 'all' || spot.category === categoryFilter.value;
  return matchKeyword && matchCategory;
}));

function publishChanges() {
  spotStore.publishCatalog(editSpots.value);
  editSpots.value = cloneData(spotStore.spots);
}
function addSpot(id: string) {
  const queryTripId = typeof route.query.tripId === 'string' ? route.query.tripId : '';
  const tripId = queryTripId || tripStore.trips[0]?.id || tripStore.createTrip();
  dayPlanStore.addSpot(tripId, id, Number(route.query.dayIndex || 1));
}
function replaceReference(payload: { oldId: string; nextId: string }) {
  spotStore.replaceSpotReference(payload.oldId, payload.nextId);
}
void SpotCategory;
</script>
<style scoped>
.catalog-panel { margin-bottom: 16px; border-color: #8fafd8; }
.catalog-row { display: grid; grid-template-columns: 1fr 150px 160px; gap: 10px; align-items: center; margin: 8px 0; }
</style>
