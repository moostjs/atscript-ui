<script setup lang="ts">
import { ref } from "vue";
import type { ColumnDef } from "@atscript/ui-core";
import { getColumnWidth } from "../utils/column-width";
import AsColumnMenu from "./defaults/as-column-menu.vue";

const props = defineProps<{
  column: ColumnDef;
  sortDirection?: "asc" | "desc" | null;
}>();

const emit = defineEmits<{
  (e: "sort", column: ColumnDef, direction: "asc" | "desc" | null): void;
  (e: "hide", column: ColumnDef): void;
}>();

const menuRef = ref<InstanceType<typeof AsColumnMenu>>();
const thRef = ref<HTMLElement>();

function toggleSort() {
  if (!props.column.sortable) return;
  const next =
    props.sortDirection === "asc" ? "desc" : props.sortDirection === "desc" ? null : "asc";
  emit("sort", props.column, next);
}

function onContextMenu(event: MouseEvent) {
  event.preventDefault();
  if (thRef.value) {
    menuRef.value?.show(thRef.value);
  }
}

function onMenuSort(direction: "asc" | "desc") {
  emit("sort", props.column, direction);
}

function onMenuHide() {
  emit("hide", props.column);
}

function sortLabel(): string {
  if (props.sortDirection === "asc") return " \u25B2";
  if (props.sortDirection === "desc") return " \u25BC";
  return "";
}
</script>

<template>
  <th
    ref="thRef"
    :style="{ width: getColumnWidth(props.column), minWidth: getColumnWidth(props.column) }"
    :class="{ 'as-th-sortable': props.column.sortable }"
    @click="toggleSort"
    @contextmenu="onContextMenu"
  >
    <span class="as-th-label">
      {{ props.column.label }}{{ sortLabel() }}
    </span>
    <AsColumnMenu ref="menuRef" :column="props.column" @sort="onMenuSort" @hide="onMenuHide" />
  </th>
</template>
