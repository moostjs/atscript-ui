<script setup lang="ts">
import type { TableDef } from "@atscript/ui";
import TableSearch from "./TableSearch.vue";

defineProps<{
  tableDef?: TableDef;
  loadedCount: number;
  totalCount: number;
}>();

const emit = defineEmits<{
  (e: "config"): void;
}>();
</script>

<template>
  <div class="table-toolbar">
    <TableSearch v-if="tableDef?.searchable" />
    <span class="table-count">{{ loadedCount }} of {{ totalCount }}</span>
    <button class="table-config-btn" type="button" @click="emit('config')">&#x2699;</button>
  </div>
</template>

<style scoped>
.table-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}
.table-toolbar :deep(input[type="search"]) {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  min-width: 200px;
}
.table-toolbar :deep(input[type="search"]:focus) {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
.table-count {
  font-size: 13px;
  color: #6b7280;
  white-space: nowrap;
  margin-left: auto;
}
.table-config-btn {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
}
.table-config-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}
</style>
