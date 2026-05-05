<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
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

const scopeClass = computed<string>(() => {
  switch (value.value) {
    case "active":
    case "delivered":
    case "shipped":
      return "scope-good";
    case "pending":
    case "processing":
    case "invited":
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
    <span v-if="value" class="as-status-badge" :class="scopeClass">{{ value }}</span>
  </td>
</template>
