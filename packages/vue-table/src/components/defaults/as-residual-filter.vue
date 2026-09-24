<script setup lang="ts">
import { computed } from "vue";
import type { FilterExpr } from "@uniqu/core";
import { formatFilterExpr } from "@atscript/ui-table";
import { useTableContext } from "../../composables/use-table-state";

/**
 * One residual filter condition (`state.residualFilters[index]`) as a chip:
 * a condition the per-field filters cannot hold — typically restored from a
 * link — shown in words so the user can see what narrows the table, with a
 * button that removes it. Rendered by `<AsFilters>`; swap it via the
 * `residualFilter` control.
 *
 * @since 0.1.140
 */
const props = defineProps<{
  expr: FilterExpr;
  index: number;
}>();

const { state } = useTableContext();

const text = computed(() => {
  const labels = new Map(state.allColumns.value.map((c) => [c.path, c.label]));
  return formatFilterExpr(props.expr, (path) => labels.get(path));
});
</script>

<template>
  <div class="as-residual-filter" :title="text">
    <span class="as-residual-filter-label">Custom filter</span>
    <span class="as-residual-filter-text">{{ text }}</span>
    <button
      type="button"
      class="as-residual-filter-remove"
      aria-label="Remove custom filter"
      @click="state.removeResidualFilter(props.index)"
    >
      <span class="i-as-close" aria-hidden="true" />
    </button>
  </div>
</template>
