<template>
  <el-tag :type="type" size="small">
    目录第 {{ version }} 版{{ suffix }}
  </el-tag>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ version: number; type?: 'success' | 'warning' | 'info'; suffix?: string }>(), {
  type: 'info',
  suffix: '',
});
</script>
