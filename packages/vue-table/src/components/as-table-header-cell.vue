<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui-core";
import { getColumnWidth } from "../utils/column-width";

const props = defineProps<{
  column: ColumnDef;
  sortDirection?: "asc" | "desc" | null;
}>();

const emit = defineEmits<{
  (e: "sort", column: ColumnDef, direction: "asc" | "desc" | null): void;
}>();

function toggleSort() {
  if (!props.column.sortable) return;
  const next =
    props.sortDirection === "asc" ? "desc" : props.sortDirection === "desc" ? null : "asc";
  emit("sort", props.column, next);
}

function sortLabel(): string {
  if (props.sortDirection === "asc") return " \u25B2";
  if (props.sortDirection === "desc") return " \u25BC";
  return "";
}
</script>

<template>
  <th
    :style="{ width: getColumnWidth(props.column), minWidth: getColumnWidth(props.column) }"
    :class="{ 'as-th-sortable': props.column.sortable }"
    @click="toggleSort"
  >
    <span class="as-th-label">{{ props.column.label }}{{ sortLabel() }}</span>
  </th>
</template>
