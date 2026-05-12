<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { getCellValue } from "../../utils/get-cell-value";
import { formatCellValue } from "../../utils/format-cell";
import AsCellJsonPopover from "../internal/as-cell-json-popover.vue";

type View =
  | { kind: "array-chips"; items: unknown[] }
  | { kind: "array-json"; items: unknown[] }
  | { kind: "array-empty" }
  | { kind: "object"; value: object }
  | { kind: "primitive"; value: unknown };

const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

const view = computed<View>(() => {
  const v = getCellValue(props.row, props.column.path);
  if (Array.isArray(v)) {
    if (v.length === 0) return { kind: "array-empty" };
    let primitive = true;
    for (const el of v) {
      const t = typeof el;
      if (t !== "string" && t !== "number" && t !== "boolean") {
        primitive = false;
        break;
      }
    }
    return primitive ? { kind: "array-chips", items: v } : { kind: "array-json", items: v };
  }
  if (v && typeof v === "object") return { kind: "object", value: v as object };
  return { kind: "primitive", value: v };
});
</script>

<template>
  <td>
    <span v-if="view.kind === 'array-chips'" class="as-cell-chips">
      <span v-for="(item, i) in view.items" :key="i" class="as-cell-chip">{{ item }}</span>
    </span>
    <AsCellJsonPopover v-else-if="view.kind === 'array-json'" :value="view.items">
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
    <AsCellJsonPopover v-else-if="view.kind === 'object'" :value="view.value">
      <template #trigger>
        <button type="button" class="as-cell-json-trigger" aria-label="View object">
          <span class="as-cell-json-trigger-glyph">{}</span>
        </button>
      </template>
    </AsCellJsonPopover>
    <template v-else-if="view.kind === 'primitive'">
      {{ formatCellValue(view.value, props.column.type) }}
    </template>
  </td>
</template>
