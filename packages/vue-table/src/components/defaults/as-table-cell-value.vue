<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";
import { displayCellValue } from "../../utils/display-cell-value";

const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

/** Union columns show the option label (`@ui.literalLabel`); anything else formats by type. */
function display(): string {
  return displayCellValue(props.row, props.column);
}
</script>

<template>
  <td :class="{ 'as-cell-number': props.column.type === 'number' }">
    {{ display() }}
  </td>
</template>
