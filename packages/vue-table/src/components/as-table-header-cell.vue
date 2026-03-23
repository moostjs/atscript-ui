<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";
import { getColumnWidth } from "../utils/column-width";
import AsColumnMenu from "./defaults/as-column-menu.vue";

const props = defineProps<{
  column: ColumnDef;
  sortDirection?: "asc" | "desc" | null;
}>();

const emit = defineEmits<{
  (e: "sort", column: ColumnDef, direction: "asc" | "desc" | null): void;
  (e: "hide", column: ColumnDef): void;
  (e: "filter", column: ColumnDef): void;
}>();

function toggleSort() {
  if (!props.column.sortable) return;
  const next =
    props.sortDirection === "asc" ? "desc" : props.sortDirection === "desc" ? null : "asc";
  emit("sort", props.column, next);
}

function onMenuSort(direction: "asc" | "desc") {
  emit("sort", props.column, direction);
}

function onMenuHide() {
  emit("hide", props.column);
}

function onMenuFilter() {
  emit("filter", props.column);
}

function sortLabel(): string {
  if (props.sortDirection === "asc") return " \u25B2";
  if (props.sortDirection === "desc") return " \u25BC";
  return "";
}
</script>

<template>
  <AsColumnMenu :column="props.column" @sort="onMenuSort" @hide="onMenuHide" @filter="onMenuFilter">
    <th
      :style="{ width: getColumnWidth(props.column), minWidth: getColumnWidth(props.column) }"
      :class="{ 'as-th-sortable': props.column.sortable }"
      @click="toggleSort"
    >
      <span class="as-th-label"> {{ props.column.label }}{{ sortLabel() }} </span>
    </th>
  </AsColumnMenu>
</template>
