<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";
import { getCellValue } from "../../utils/get-cell-value";
import { formatCellValue } from "../../utils/format-cell";

const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();
</script>

<template>
  <td :class="{ 'as-cell-number': props.column.type === 'number' }">
    {{ formatCellValue(getCellValue(props.row, props.column.path), props.column.type) }}
  </td>
</template>
