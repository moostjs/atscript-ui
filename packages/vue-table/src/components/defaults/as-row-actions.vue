<script setup lang="ts">
// Class extractor safelist — runtime-composed classes (template-literal
// interpolation in <AsActionMenuItem> and <AsActionMenuContent> + dynamic
// `${prefix}-intent-${intent}` variants the build-time tokenizer can't see):
//   as-row-actions-menu
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
  applyRowGate,
  ariaLabelFor,
  extractIdentifier,
  intentClass,
  triggerAction,
} from "../../composables/state/intent-scope";
import AsActionMenuContent from "../internal/as-action-menu-content.vue";
import type { TVueTableActionInfo } from "../../types";

const props = defineProps<{
  row?: Record<string, unknown>;
  pk?: Record<string, unknown>;
}>();

const { state } = useTableContext();

const view = computed(() => {
  const sourceDefault = state.actions.default.row;
  const filtered = applyRowGate(
    {
      default: sourceDefault,
      others: state.actions.others.row,
      rows: state.actions.rows,
    },
    props.row,
  );
  const total = (filtered.default ? 1 : 0) + filtered.others.length + filtered.rows.length;
  const single =
    total === 1 ? (filtered.default ?? filtered.others[0] ?? filtered.rows[0]) : undefined;

  return {
    total,
    default: filtered.default,
    single,
    singleLabelOnly: !!single && !single.icon,
    singleIntentClass: single ? intentClass("as-row-actions", single) : undefined,
    singleIsDefault: !!single && single === sourceDefault,
    menuGroups: [filtered.default ? [filtered.default] : [], filtered.others, filtered.rows],
  };
});

async function trigger(action: TVueTableActionInfo, event?: MouseEvent | KeyboardEvent) {
  const preferredId = state.tableDef.value?.preferredId ?? [];
  const id = props.pk !== undefined ? props.pk : extractIdentifier(props.row, preferredId);
  const identifiers = id === undefined ? [] : [id];
  await triggerAction(state, action, { identifiers, preferredId }, event);
}
</script>

<template>
  <!-- table-layout: fixed needs a placeholder cell so column widths line up. -->
  <td v-if="view.total === 0" class="as-row-actions" />
  <td v-else-if="view.single" class="as-row-actions">
    <button
      type="button"
      class="as-row-actions-btn"
      :class="[
        view.singleLabelOnly ? 'as-row-actions-btn-labelled' : undefined,
        view.singleIntentClass,
      ]"
      :data-default="view.singleIsDefault || undefined"
      :aria-label="ariaLabelFor(view.single)"
      :title="ariaLabelFor(view.single)"
      @click.stop="trigger(view.single, $event)"
    >
      <span
        v-if="view.single.icon"
        :class="['as-row-actions-btn-icon', view.single.icon]"
        aria-hidden="true"
      />
      <span v-else class="as-row-actions-btn-label">{{
        view.single.label || view.single.name
      }}</span>
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
          :groups="view.menuGroups"
          :default-marker="view.default"
          prefix="as-row-actions"
          @select="trigger"
        />
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </td>
</template>
