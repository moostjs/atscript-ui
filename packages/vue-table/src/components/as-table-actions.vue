<script setup lang="ts">
// Class extractor safelist — runtime-composed classes (template-literal
// interpolation in <AsActionMenuItem> and <AsActionMenuContent> + dynamic
// `${prefix}-intent-${intent}` variants the build-time tokenizer can't see):
//   as-table-actions-menu-item
//   as-table-actions-menu-item-icon
//   as-table-actions-menu-item-label
//   as-table-actions-menu-separator
//   as-table-actions-intent-positive
//   as-table-actions-intent-negative
//   as-table-actions-intent-warning
//   as-table-actions-intent-primary
//   as-table-actions-intent-secondary
import { computed } from "vue";
import { DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from "reka-ui";
import { useTableContext } from "../composables/use-table-state";
import {
  ariaLabelFor,
  confirmAction,
  extractPk,
  intentClass,
  pkForLevel,
} from "../composables/state/intent-scope";
import AsActionMenuContent from "./internal/as-action-menu-content.vue";
import type { TVueTableActionInfo } from "../types";

const props = withDefaults(
  defineProps<{
    /**
     * Selection-aware level resolution. `'auto'` (default) chooses by
     * `state.selectedCount`: 0 → table; exactly 1 → row (default + others
     * come from the row group, with `actions.rows` appended after a
     * separator inside the `…` menu so bulk operations on the single
     * selection are still reachable); ≥2 → rows. Force a specific level
     * with `'table'` / `'rows'` / `'row'`.
     */
    level?: "auto" | "table" | "rows" | "row";
  }>(),
  { level: "auto" },
);

const { state } = useTableContext();

interface Resolved {
  defaultAction: TVueTableActionInfo | undefined;
  otherActions: TVueTableActionInfo[];
  /**
   * Cross-bucket actions appended after a `<DropdownMenuSeparator>` when
   * exactly one row is selected in `level="auto"`. Carries `actions.rows`
   * so bulk operations on the single selection stay reachable while the
   * primary CTA / others come from the row bucket. Empty otherwise.
   */
  trailingRowActions: TVueTableActionInfo[];
  level: "table" | "rows" | "row";
  ids: unknown[];
}

// Promote a sole non-default entry into `defaultAction` so it renders as a
// labelled button rather than hiding alone behind a `…` dropdown.
function collapseSingle(r: Resolved): Resolved {
  if (r.defaultAction !== undefined) return r;
  const total = r.otherActions.length + r.trailingRowActions.length;
  if (total !== 1) return r;
  const [only] = r.otherActions.length === 1 ? r.otherActions : r.trailingRowActions;
  return { ...r, defaultAction: only, otherActions: [], trailingRowActions: [] };
}

function resolveLevel(
  explicit: typeof props.level,
  selectedCount: number,
): "table" | "rows" | "row" {
  if (explicit !== "auto") return explicit;
  if (selectedCount === 0) return "table";
  if (selectedCount === 1) return "row";
  return "rows";
}

const resolved = computed<Resolved>(() => {
  const selectedCount = state.selectedCount.value;
  const explicit = props.level;
  const effectiveLevel = resolveLevel(explicit, selectedCount);

  if (effectiveLevel === "table") {
    return collapseSingle({
      defaultAction: state.actions.default.table,
      otherActions: state.actions.others.table,
      trailingRowActions: [],
      level: "table",
      ids: [],
    });
  }
  if (effectiveLevel === "row") {
    const ids: unknown[] = [];
    if (explicit === "auto" && selectedCount === 1) {
      // Auto + 1 selected: drive the toolbar from the user's selection, not
      // the active (highlighted) row. selectedRows already carries the pk
      // shape produced by the consumer's `rowValueFn`.
      const sel = state.selectedRows.value[0];
      if (sel !== undefined) ids.push(sel);
    } else {
      const activeIdx = state.activeIndex.value;
      if (activeIdx >= 0) {
        const row = state.results.value[activeIdx - state.resultsStart.value];
        const pk = extractPk(row, state.tableDef.value?.primaryKeys ?? []);
        if (pk !== undefined) ids.push(pk);
      }
    }
    // Auto + 1: surface bulk actions in the trailing menu so e.g. "Suspend
    // selected" stays reachable while the row default renders as the CTA.
    const trailing = explicit === "auto" && selectedCount === 1 ? state.actions.rows : [];
    return collapseSingle({
      defaultAction: state.actions.default.row,
      otherActions: state.actions.others.row,
      trailingRowActions: trailing,
      level: "row",
      ids,
    });
  }
  return collapseSingle({
    defaultAction: state.actions.default.rows,
    otherActions: state.actions.others.rows,
    trailingRowActions: [],
    level: "rows",
    ids: state.selectedRows.value.slice(),
  });
});

const hasAny = computed(
  () =>
    resolved.value.defaultAction !== undefined ||
    resolved.value.otherActions.length > 0 ||
    resolved.value.trailingRowActions.length > 0,
);

async function invokeWith(action: TVueTableActionInfo, event?: MouseEvent | KeyboardEvent) {
  const ok = await confirmAction(state, action);
  if (!ok) return;
  // pk shape follows the action's own level, not the resolved bucket — auto+1
  // mixes row-level and rows-level actions in the same dropdown.
  void state.actions.invoke(action, pkForLevel(action.level, resolved.value.ids), { event });
}
</script>

<template>
  <span v-if="hasAny" class="as-table-actions">
    <slot
      :default-action="resolved.defaultAction"
      :other-actions="resolved.otherActions"
      :trailing-row-actions="resolved.trailingRowActions"
      :level="resolved.level"
      :ids="resolved.ids"
      :invoke="invokeWith"
    >
      <button
        v-if="resolved.defaultAction"
        type="button"
        class="as-table-actions-btn"
        :class="intentClass('as-table-actions', resolved.defaultAction)"
        data-default
        :aria-label="ariaLabelFor(resolved.defaultAction)"
        :title="ariaLabelFor(resolved.defaultAction)"
        @click="invokeWith(resolved.defaultAction, $event)"
      >
        <slot name="button" :action="resolved.defaultAction">
          <span
            v-if="resolved.defaultAction.icon"
            :class="['as-table-actions-btn-icon', resolved.defaultAction.icon]"
            aria-hidden="true"
          />
          <span class="as-table-actions-btn-label">{{
            resolved.defaultAction.label || resolved.defaultAction.name
          }}</span>
        </slot>
      </button>

      <DropdownMenuRoot
        v-if="resolved.otherActions.length > 0 || resolved.trailingRowActions.length > 0"
        :modal="false"
      >
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="as-table-actions-more"
            aria-label="More actions"
            title="More actions"
          >
            <span class="i-as-menu" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <AsActionMenuContent
            :groups="[resolved.otherActions, resolved.trailingRowActions]"
            prefix="as-table-actions"
            @select="invokeWith"
          >
            <template v-if="$slots['menu-item']" #menu-item="slotProps">
              <slot name="menu-item" :action="slotProps.action" />
            </template>
          </AsActionMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </slot>
  </span>
</template>
