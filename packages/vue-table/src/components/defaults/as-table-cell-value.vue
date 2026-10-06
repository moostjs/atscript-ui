<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";
import { getCellValue } from "../../utils/get-cell-value";
import { formatCellValue } from "../../utils/format-cell";

const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

/** Union columns show the option label (`@ui.literalLabel`); anything else formats by type. */
function display(): string {
  const value = getCellValue(props.row, props.column.path);
  const options = props.column.options;
  if (options?.length && value !== null && typeof value !== "object") {
    const key = String(value);
    const hit = options.find((o) => o.key === key);
    if (hit) return hit.label;
  }
  return formatCellValue(value, props.column.type);
}
</script>

<template>
  <td :class="{ 'as-cell-number': props.column.type === 'number' }">
    {{ display() }}
  </td>
</template>
