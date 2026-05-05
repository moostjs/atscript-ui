<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { getCellValue } from "../../utils/get-cell-value";
import AsCellJsonPopover from "../internal/as-cell-json-popover.vue";

const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

const value = computed(() => getCellValue(props.row, props.column.path));
</script>

<template>
  <td>
    <AsCellJsonPopover v-if="value && typeof value === 'object'" :value="value">
      <template #trigger>
        <button type="button" class="as-cell-json-trigger" aria-label="View object">
          <span class="as-cell-json-trigger-glyph">{}</span>
        </button>
      </template>
    </AsCellJsonPopover>
  </td>
</template>
