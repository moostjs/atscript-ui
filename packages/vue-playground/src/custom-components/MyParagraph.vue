<script setup lang="ts">
import type { TAsComponentProps } from "@atscript/vue-form";

defineProps<TAsComponentProps<never>>();
</script>

<template>
  <div v-show="!hidden" class="custom-paragraph" :class="class" :style="style">
    <p class="custom-paragraph-text">{{ value }}</p>
  </div>
</template>

<style scoped>
.custom-paragraph {
  padding: 12px 16px;
  border-left: 3px solid #6366f1;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  border-radius: 0 8px 8px 0;
  margin: 4px 0;
}

.custom-paragraph-text {
  margin: 0;
  font-size: 14px;
  color: #3730a3;
  line-height: 1.5;
}
</style>
