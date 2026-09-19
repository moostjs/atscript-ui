<script lang="ts">
// `$attrs` are forwarded to EVERY filter field (the behaviour before this
// component grew a root element), so Vue's auto-inherit must stay off or the
// wrapper would swallow them.
export default { inheritAttrs: false };
</script>

<script setup lang="ts">
import { computed } from "vue";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import type { ColumnDef } from "@atscript/ui";
import { useTableContext } from "../composables/use-table-state";
import { useTableComponent } from "../composables/use-table-component";
import AsFilterField from "./defaults/as-filter-field.vue";

const props = defineProps<{
  filterFields?: string[];
  /**
   * Hard cap on how many filter fields render inline. Deterministic and
   * count-based — this component never measures the toolbar. Width-driven
   * responsiveness stays with the host, which already knows its own
   * breakpoints and can feed a shorter `filterFields` list (or a smaller
   * `maxVisible`).
   *
   * Omitted (the default) → every field renders inline, exactly as before.
   *
   * @since 0.1.133
   */
  maxVisible?: number;
  /**
   * What happens to the fields past `maxVisible`:
   * - `'popover'` (the default whenever `maxVisible` is set) — they move into
   *   a popover behind a "More filters" trigger, which badges the number of
   *   ACTIVE hidden filters so nothing silently narrows the table from
   *   off-screen.
   * - `'none'` — they are not rendered at all. Pick this only when the host
   *   surfaces them elsewhere (e.g. its own filter dialog); an active filter
   *   on a dropped field still applies to the query.
   *
   * Ignored when `maxVisible` is omitted.
   *
   * @since 0.1.133
   */
  overflow?: "popover" | "none";
}>();

const { state } = useTableContext();
// Static skin-slot resolution — `controls.filterField ?? AsFilterField`.
const FilterField = useTableComponent("filterField", AsFilterField);

const columnMap = computed(() => {
  const tableDef = state.tableDef.value;
  if (!tableDef) return new Map<string, ColumnDef>();
  const map = new Map<string, ColumnDef>();
  for (const col of tableDef.columns) {
    map.set(col.path, col);
  }
  return map;
});

const activeColumns = computed(() => {
  const fields = props.filterFields ?? state.filterFields.value;
  const map = columnMap.value;
  if (map.size === 0) return [];
  const result: ColumnDef[] = [];
  for (const path of fields) {
    const col = map.get(path);
    if (col) result.push(col);
  }
  return result;
});

/**
 * The inline / overflow split, in one pass. `maxVisible` unset → no split at
 * all (and `overflow` is moot), which is why `overflow` is empty rather than
 * hidden-behind-a-trigger in that case.
 */
const split = computed(() => {
  const all = activeColumns.value;
  if (props.maxVisible === undefined) return { visible: all, overflow: [] as ColumnDef[] };
  const limit = Math.max(0, props.maxVisible);
  return { visible: all.slice(0, limit), overflow: all.slice(limit) };
});

// Badge count — a hidden filter that is actually narrowing the result set must
// stay discoverable, or the table looks wrong for no visible reason.
const activeOverflowCount = computed(() => {
  const filters = state.filters.value;
  let n = 0;
  for (const col of split.value.overflow) {
    if ((filters[col.path]?.length ?? 0) > 0) n++;
  }
  return n;
});
</script>

<template>
  <!-- Multi-root fragment on purpose: the fields (and the overflow trigger)
       are direct children of whatever toolbar row the host wraps this in,
       so this component adds no box and no layout of its own. -->
  <component
    :is="FilterField"
    v-for="col in split.visible"
    :key="col.path"
    :column="col"
    v-bind="$attrs"
  />

  <PopoverRoot v-if="(props.overflow ?? 'popover') === 'popover' && split.overflow.length > 0">
    <PopoverTrigger class="as-filters-overflow-trigger" aria-label="More filters">
      <span class="i-as-filter as-filters-overflow-trigger-icon" aria-hidden="true" />
      <span v-if="activeOverflowCount > 0" class="as-filters-overflow-badge">
        {{ activeOverflowCount }}
      </span>
      <span class="i-as-chevron-down as-filters-overflow-chevron" aria-hidden="true" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="as-filters-overflow"
        align="end"
        :side-offset="4"
        :collision-padding="8"
      >
        <component
          :is="FilterField"
          v-for="col in split.overflow"
          :key="col.path"
          :column="col"
          v-bind="$attrs"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
