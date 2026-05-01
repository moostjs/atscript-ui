<script setup lang="ts">
// Class extractor safelist — runtime-composed classes (template-literal
// interpolation in <AsActionMenuItem> and <AsActionMenuContent> + dynamic
// `${prefix}-intent-${intent}` variants the build-time tokenizer can't see):
//   as-row-actions-menu-item
//   as-row-actions-menu-item-icon
//   as-row-actions-menu-item-label
//   as-row-actions-menu-separator
//   as-row-actions-intent-positive
//   as-row-actions-intent-negative
//   as-row-actions-intent-warning
//   as-row-actions-intent-primary
//   as-row-actions-intent-secondary
//   as-row-actions-btn-labelled
import { computed } from "vue";
import { DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from "reka-ui";
import { useTableContext } from "../../composables/use-table-state";
import {
  ariaLabelFor,
  confirmAction,
  extractPk,
  formatPk,
  intentClass,
  pkForLevel,
} from "../../composables/state/intent-scope";
import AsActionMenuContent from "../internal/as-action-menu-content.vue";
import type { TVueTableActionInfo } from "../../types";

const props = defineProps<{
  /** Row data — used when rendered as a cell via the cell-type dispatch. */
  row?: Record<string, unknown>;
  /** Direct primary-key override. Wins over `row` when provided. */
  pk?: unknown;
}>();

const { state } = useTableContext();

const resolvedPk = computed(() =>
  props.pk !== undefined
    ? props.pk
    : extractPk(props.row, state.tableDef.value?.primaryKeys ?? []),
);

const single = computed<TVueTableActionInfo | undefined>(() => {
  const list = state.actions.cellRow;
  return list.length === 1 ? list[0] : undefined;
});
const singleIsLabelOnly = computed(() => !!single.value && !single.value.icon);
const singleIntentClass = computed(() =>
  single.value ? intentClass("as-row-actions", single.value) : undefined,
);
const singleIsDefault = computed(
  () => !!single.value && single.value === state.actions.default.row,
);

const menuGroups = computed(() => [
  state.actions.default.row ? [state.actions.default.row] : [],
  state.actions.others.row,
  state.actions.rows,
]);

async function trigger(action: TVueTableActionInfo, event?: MouseEvent | KeyboardEvent) {
  const ok = await confirmAction(state, action, (text) =>
    text.replace(/\{pk\}/g, () => formatPk(resolvedPk.value)),
  );
  if (!ok) return;
  const ids = resolvedPk.value === undefined ? [] : [resolvedPk.value];
  void state.actions.invoke(action, pkForLevel(action.level, ids), { event });
}
</script>

<template>
  <!-- table-layout: fixed needs a placeholder cell so column widths line up. -->
  <td v-if="state.actions.cellRow.length === 0" class="as-row-actions" />
  <td v-else-if="single" class="as-row-actions">
    <button
      type="button"
      class="as-row-actions-btn"
      :class="[
        singleIsLabelOnly ? 'as-row-actions-btn-labelled' : undefined,
        singleIntentClass,
      ]"
      :data-default="singleIsDefault || undefined"
      :aria-label="ariaLabelFor(single)"
      :title="ariaLabelFor(single)"
      @click.stop="trigger(single, $event)"
    >
      <span
        v-if="single.icon"
        :class="['as-row-actions-btn-icon', single.icon]"
        aria-hidden="true"
      />
      <span v-else class="as-row-actions-btn-label">{{ single.label || single.name }}</span>
    </button>
  </td>
  <td v-else class="as-row-actions">
    <DropdownMenuRoot :modal="false">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="as-row-actions-btn as-row-actions-more"
          aria-label="Row actions"
          title="Row actions"
          @click.stop
        >
          <span class="as-row-actions-btn-icon i-as-menu" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <AsActionMenuContent
          :groups="menuGroups"
          :default-marker="state.actions.default.row"
          prefix="as-row-actions"
          @select="trigger"
        />
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </td>
</template>
