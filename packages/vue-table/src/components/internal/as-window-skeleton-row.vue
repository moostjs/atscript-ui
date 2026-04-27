<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";

defineProps<{
  columns: ColumnDef[];
  rowHeight: number;
  /** When the parent renders a select column, render a leading empty <td>. */
  hasSelect?: boolean;
  /**
   * When the loadRange request for this row's block errored. Renders the
   * same `<tr>` structure (so the table-fixed column layout stays stable)
   * but drops the shimmer animation — failed rows shouldn't pretend to be
   * still loading.
   */
  errored?: boolean;
}>();
</script>

<template>
  <tr
    :class="errored ? 'as-window-empty-row' : 'as-window-skeleton-row'"
    :style="{ height: `${rowHeight}px` }"
  >
    <td v-if="hasSelect" class="as-window-skeleton-cell" />
    <td v-for="col in columns" :key="col.path" class="as-window-skeleton-cell" />
    <!-- Stretch filler cell — mirrors the data row's `<td class="as-td-filler" />`
         so the skeleton spans the full table width including the trailing
         expander column. Without this, table-fixed layout would leave the
         filler column blank on skeleton rows. -->
    <td class="as-td-filler" />
  </tr>
</template>
