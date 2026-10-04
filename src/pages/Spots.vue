<template>
  <main class="page">
    <h1>景点探索</h1>
    <div class="toolbar">
      <el-input v-model="spotStore.keyword" placeholder="搜索景点、标签" style="max-width: 260px" />
      <CategoryFilter v-model="spotStore.category" />
      <CatalogVersionBadge :version="catalogStore.latestVersion" type="success" suffix=" · 目录改价会从这版续作" />
    </div>

    <el-alert type="info" :closable="false" class="band" style="margin-bottom: 14px">
      <template #title>
        目录调价 / 改分类会发布新版本：未确认安排与预算自动按新版重算；已确认安排保持确认那天的固定价。
        「替换」会清掉未确认行程里的旧景点引用。
      </template>
    </el-alert>

    <SaveRecoveryBar />

    <EmptyState v-if="!spotStore.filteredSpots.length" title="没有景点" :description="messages.emptySpots" />
    <section class="grid">
      <article v-for="spot in spotStore.filteredSpots" :key="spot.id" class="spot-wrap band">
        <SpotCard :spot="spot" @favorite="spotStore.toggleFavorite" @add="addSpot" />
        <div class="admin">
          <el-input-number v-model="priceDrafts[spot.id]" :min="0" :step="10" size="small" />
          <el-button size="small" @click="amendPrice(spot.id)">调价并出新版</el-button>
          <el-select v-model="categoryDrafts[spot.id]" size="small" style="width: 120px">
            <el-option v-for="opt in SPOT_CATEGORY_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-button size="small" @click="amendCategory(spot.id)">改分类并出新版</el-button>
          <el-button size="small" type="warning" @click="replace(spot.id)">替换景点</el-button>
        </div>
      </article>
    </section>

    <section class="band" style="margin-top: 18px">
      <div class="toolbar">
        <el-checkbox v-model="faultDemo">演示：下一次「替换景点」在写入行程前失败（刷新后从完整步骤恢复）</el-checkbox>
      </div>
      <h3>目录版本历史（只追加，可续作）</h3>
      <el-timeline>
        <el-timeline-item v-for="version in [...catalogStore.versions].reverse()" :key="version.version"
          :timestamp="version.created_at" placement="top">
          <strong>v{{ version.version }}</strong> · {{ version.note }}
        </el-timeline-item>
      </el-timeline>
    </section>
  </main>
</template>
<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useTripStore } from '../stores/tripStore';
import { useSpotStore } from '../stores/spotStore';
import { useDayPlanStore } from '../stores/dayPlanStore';
import { useCatalogStore } from '../stores/catalogStore';
import CategoryFilter from '../components/common/CategoryFilter.vue';
import SpotCard from '../components/common/SpotCard.vue';
import EmptyState from '../components/common/EmptyState.vue';
import SaveRecoveryBar from '../components/common/SaveRecoveryBar.vue';
import CatalogVersionBadge from '../components/common/CatalogVersionBadge.vue';
import { messages } from '../constants/messages';
import { SPOT_CATEGORY_OPTIONS, SpotCategory } from '../constants/spot';
import { STORAGE_KEYS } from '../constants/storageVersion';
import { faultInject } from '../utils/storage';
import type { Spot } from '../models/spot';

const tripStore = useTripStore();
const spotStore = useSpotStore();
const dayPlanStore = useDayPlanStore();
const catalogStore = useCatalogStore();

const priceDrafts = reactive<Record<string, number>>({});
const categoryDrafts = reactive<Record<string, SpotCategory>>({});
// 目录替换/调价后出现的新景点也要有可编辑的草稿初值
watch(
  () => spotStore.spots,
  (spots) => {
    for (const spot of spots) {
      if (priceDrafts[spot.id] === undefined) priceDrafts[spot.id] = spot.price;
      if (!categoryDrafts[spot.id]) categoryDrafts[spot.id] = spot.category;
    }
  },
  { immediate: true, deep: true },
);

function addSpot(id: string) {
  const tripId = tripStore.trips[0]?.id || tripStore.createTrip();
  dayPlanStore.addSpot(tripId, id, 1);
}

function amendPrice(id: string) {
  catalogStore.amendSpot(id, { price: priceDrafts[id] });
}
function amendCategory(id: string) {
  catalogStore.amendSpot(id, { category: categoryDrafts[id] });
}

// 替换景点：造一个新景点顶掉旧的；旧 spot_id 在未确认行程里的引用由事务 PURGE_REFS 清掉。
let replaceSeq = 0;
function replace(oldId: string) {
  replaceSeq += 1;
  const old = spotStore.spots.find((spot) => spot.id === oldId);
  const replacement: Spot = {
    id: 'spot-replaced-' + Date.now(),
    name: (old?.name || '景点') + '（新址' + replaceSeq + '）',
    category: categoryDrafts[oldId] || SpotCategory.ENTERTAINMENT,
    address: old?.address || '',
    lat: old?.lat || 0,
    lng: old?.lng || 0,
    rating: 4.6,
    price: priceDrafts[oldId] ?? 0,
    open_time: '09:00-18:00',
    tags: ['新开放'],
    image: old?.image || '',
  };
  // 演示用：勾选后让下一次目录改版在「写入每日行程」前中断，刷新页面可恢复
  if (faultDemo.value) {
    faultInject.arm(STORAGE_KEYS.dayPlans);
  }
  catalogStore.replaceSpot(oldId, replacement);
  faultDemo.value = false;
}

// 页面开关：演示「保存写一半失败 → 从完整步骤恢复」
const faultDemo = ref(false);
</script>
<style scoped>
.spot-wrap { padding: 12px; }
.admin { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 10px; border-top: 1px dashed #cdd8c4; padding-top: 10px; }
</style>
