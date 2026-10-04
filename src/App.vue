<template>
  <GlobalErrorBoundary>
    <nav class="app-nav">
      <strong>TripWeaver</strong>
      <RouterLink to="/trips">我的旅行</RouterLink>
      <RouterLink to="/spots">景点探索</RouterLink>
      <RouterLink to="/share">分享预览</RouterLink>
      <el-select v-model="collabStore.author" size="small" @change="collabStore.setAuthor(collabStore.author)" style="width: 130px">
        <el-option label="同行人 A" value="同行人 A" />
        <el-option label="同行人 B" value="同行人 B" />
      </el-select>
      <el-select v-model="themeStore.theme" size="small" @change="themeStore.setTheme" style="width: 120px">
        <el-option label="清爽地图" value="fresh" />
        <el-option label="傍晚地图" value="dusk" />
      </el-select>
    </nav>
    <div class="page" style="padding-top: 8px; padding-bottom: 0">
      <SaveRecoveryBar />
    </div>
    <RouterView />
  </GlobalErrorBoundary>
</template>
<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import GlobalErrorBoundary from './components/common/GlobalErrorBoundary';
import SaveRecoveryBar from './components/common/SaveRecoveryBar.vue';
import { useThemeStore } from './stores/themeStore';
import { useJournalStore } from './stores/journalStore';
import { useCollabStore } from './stores/collabStore';
import { useStorageSync } from './hooks/useStorageSync';
const themeStore = useThemeStore();
const journalStore = useJournalStore();
const collabStore = useCollabStore();
onMounted(() => {
  // 上次保存写到一半就关掉页面，这里从完整步骤里找出断点
  journalStore.recoverOnBoot();
  // 另一个标签页（另一位同行人）保存后，本页同步到最新 revision 与冲突状态
  useStorageSync();
});
</script>
<style scoped>
.app-nav { display: flex; gap: 18px; align-items: center; padding: 14px 28px; background: #1f3d2b; color: #f7ffe8; flex-wrap: wrap; }
.router-link-active { text-decoration: underline; }
</style>
