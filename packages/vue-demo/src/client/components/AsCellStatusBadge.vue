<script setup lang="ts">
import { computed } from "vue";
import { optionLabel, type ColumnDef } from "@atscript/ui";
import { getCellValue } from "@atscript/vue-table";

// Registered under both `status` (cell-type) and `status-badge` (named
// component) — exercises both extension paths from a single component.
// Unknown status keys fall through to neutral so a new value renders muted
// instead of mistinted.
const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

const value = computed(() => {
  const v = getCellValue(props.row, props.column.path);
  return typeof v === "string" ? v : "";
});

// A union column's option label (`@ui.literalLabel`) when it has one; the raw key otherwise.
const text = computed(() => optionLabel(props.column, value.value) ?? value.value);

const scopeClass = computed<string>(() => {
  switch (value.value) {
    case "active":
    case "delivered":
    case "shipped":
    case "done":
      return "scope-good";
    case "pending":
    case "processing":
    case "invited":
    case "open":
    case "in-progress":
      return "scope-warn";
    case "suspended":
    case "cancelled":
      return "scope-error";
    default:
      return "scope-neutral";
  }
});
</script>

<template>
  <td>
    <span v-if="value" class="as-status-badge" :class="scopeClass">{{ text }}</span>
  </td>
</template>
