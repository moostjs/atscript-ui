<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";
import { computed } from "vue";

const props = defineProps<{
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

// Phase-lock all skeleton rows to the same wall clock so their stripes move
// in lockstep regardless of mount time. `(now % DURATION)` is the offset
// from the most recent shared phase boundary; negating it as
// `animation-delay` snaps the row's t=0 to that boundary. Re-evaluates when
// `errored` flips so a retry (errored→ok) re-syncs against the current phase.
const SHIMMER_DURATION_MS = 4200;
const animationDelay = computed(() =>
  props.errored ? undefined : `-${performance.now() % SHIMMER_DURATION_MS}ms`,
);
</script>

<template>
  <tr
    :class="errored ? 'as-window-empty-row' : 'as-window-skeleton-row'"
    :style="{ height: `${rowHeight}px`, animationDelay }"
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
