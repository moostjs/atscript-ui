<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { getCellValue } from "../../utils/get-cell-value";
import AsCellJsonPopover from "../internal/as-cell-json-popover.vue";

const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

const view = computed<{ items: unknown[]; primitive: boolean } | undefined>(() => {
  const v = getCellValue(props.row, props.column.path);
  if (!Array.isArray(v) || v.length === 0) return undefined;
  let primitive = true;
  for (const el of v) {
    const t = typeof el;
    if (t !== "string" && t !== "number" && t !== "boolean") {
      primitive = false;
      break;
    }
  }
  return { items: v, primitive };
});
</script>

<template>
  <td>
    <span v-if="view && view.primitive" class="as-cell-chips">
      <span v-for="(item, i) in view.items" :key="i" class="as-cell-chip">{{ item }}</span>
    </span>
    <AsCellJsonPopover v-else-if="view" :value="view.items">
      <template #trigger>
        <button
          type="button"
          class="as-cell-json-trigger"
          :aria-label="`View ${view.items.length} items`"
        >
          <span class="as-cell-json-trigger-glyph">{}</span>
          <span class="as-cell-json-trigger-count">[{{ view.items.length }}]</span>
        </button>
      </template>
    </AsCellJsonPopover>
  </td>
</template>
