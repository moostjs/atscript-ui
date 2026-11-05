<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";
import { useAsTexts } from "@atscript/vue-form/locale";
import { displayCellValue } from "../../utils/display-cell-value";

const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();
const { t } = useAsTexts();

/** Union columns show the option label (`@ui.literalLabel`); anything else formats by type. */
function display(): string {
  return displayCellValue(props.row, props.column, t);
}
</script>

<template>
  <td :class="{ 'as-cell-number': props.column.type === 'number' }">
    {{ display() }}
  </td>
</template>
