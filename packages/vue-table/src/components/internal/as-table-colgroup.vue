<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";
import type { ColumnWidthsMap } from "@atscript/ui-table";
import { resolveColumnWidth } from "../../composables/use-column-header-drag-resize";

const props = defineProps<{
  columns: ColumnDef[];
  columnWidths: ColumnWidthsMap;
  /** Whether the leading select placeholder `<col>` renders. */
  hasSelect: boolean;
  /** Whether the trailing filler `<col>` renders. */
  withFiller: boolean;
}>();

// Per-`<col>` width style. Shares `resolveColumnWidth` with the header `<th>`
// so col and th never disagree; render `{ width }` only when defined.
function colStyle(col: ColumnDef): { width: string } | undefined {
  const w = resolveColumnWidth(props.columnWidths, col);
  return w ? { width: w } : undefined;
}
</script>

<template>
  <!--
    `<colgroup>` carries column widths independently of the header so widths
    survive when `<thead>` is omitted (`headless`). Col order MUST match the
    body `<td>` order exactly: select col (when `hasSelect`), data columns,
    then the filler col (when `withFiller`).
  -->
  <colgroup>
    <!-- Placeholder for the leading select column. No width — `as-td-select`
         self-sizes (`w-[4em]`); the col exists only for positional alignment. -->
    <col v-if="hasSelect" class="as-col-select" />
    <col
      v-for="col in columns"
      :key="col.path"
      :data-column-path="col.path"
      :style="colStyle(col)"
    />
    <!-- Trailing filler col; absorbs leftover space, no width. -->
    <col v-if="withFiller" class="as-col-filler" />
  </colgroup>
</template>
