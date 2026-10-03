<script setup lang="ts">
// Class extractor safelist — runtime-composed classes (template-literal
// interpolation in <AsActionMenuItem> and <AsActionMenuContent> + dynamic
// `${prefix}-intent-${intent}` variants the build-time tokenizer can't see):
//   as-row-actions-menu
//   as-row-actions-menu-item
//   as-row-actions-menu-item-icon
//   as-row-actions-menu-item-label
//   as-row-actions-menu-item-reason
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
  createNavigateGestures,
  extractIdentifier,
  identifierFieldsOf,
  intentClass,
  triggerAction,
  triggerBindings,
} from "../../composables/state/intent-scope";
import { resolveRowActions, rowActionHref } from "../../composables/state/row-actions-config";
import AsActionMenuContent from "../internal/as-action-menu-content.vue";
import type { TVueTableActionInfo } from "../../types";

const props = defineProps<{
  row?: Record<string, unknown>;
  pk?: Record<string, unknown>;
  /**
   * Render exactly these actions, bypassing the server's action set AND the
   * root's `:row-actions` policy. For a standalone `<AsRowActions>` that must
   * show a hand-picked list; omit it inside the table so the shared policy
   * applies. Since 0.1.134.
   */
  actions?: TVueTableActionInfo[];
}>();

const { state } = useTableContext();

/**
 * The row's identifier — the `pk` prop when given, else extracted from the
 * row (`identifierFields`: what a delegated action maps from rides along).
 */
function identifierOf(): Record<string, unknown> | undefined {
  return props.pk !== undefined
    ? props.pk
    : extractIdentifier(props.row, identifierFieldsOf(state.tableDef.value));
}

function promptCtx() {
  const id = identifierOf();
  return {
    identifiers: id === undefined ? [] : [id],
    preferredId: state.tableDef.value?.preferredId ?? [],
    row: props.row,
  };
}

const view = computed(() => {
  const explicit = props.actions;
  // The shared per-row pipeline: the row's server gate + the root's
  // `:row-actions` policy (an explicit `:actions` list bypasses both).
  const resolved = explicit
    ? { default: undefined, others: explicit, rows: [], extra: [] }
    : resolveRowActions(state, props.row);
  const total =
    (resolved.default ? 1 : 0) +
    resolved.others.length +
    resolved.rows.length +
    resolved.extra.length;
  const single =
    total === 1
      ? (resolved.default ?? resolved.others[0] ?? resolved.rows[0] ?? resolved.extra[0])
      : undefined;
  const singleHref = single ? hrefFor(single) : undefined;

  return {
    total,
    default: resolved.default,
    single,
    trigger: single ? triggerBindings(single, singleHref) : undefined,
    singleLabelOnly: !!single && !single.icon,
    singleIntentClass: single ? intentClass("as-row-actions", single) : undefined,
    singleIsDefault: !!single && single === resolved.default,
    singleHref,
    menuGroups: [
      resolved.default ? [resolved.default] : [],
      resolved.others,
      resolved.rows,
      resolved.extra,
    ],
  };
});

async function trigger(action: TVueTableActionInfo, event?: MouseEvent | KeyboardEvent) {
  await triggerAction(state, action, promptCtx(), event);
}

function hrefFor(action: TVueTableActionInfo): string | undefined {
  return rowActionHref(state, action, identifierOf(), props.row);
}

const { onTriggerClick, onTriggerAuxClick, openNewTab } = createNavigateGestures(
  state,
  promptCtx,
  hrefFor,
);
</script>

<template>
  <!-- table-layout: fixed needs a placeholder cell so column widths line up. -->
  <td v-if="view.total === 0" class="as-row-actions" />
  <td v-else-if="view.single && view.trigger" class="as-row-actions">
    <component
      :is="view.trigger.tag"
      v-bind="view.trigger.attrs"
      class="as-row-actions-btn"
      :class="[
        view.singleLabelOnly ? 'as-row-actions-btn-labelled' : undefined,
        view.singleIntentClass,
      ]"
      :data-default="view.singleIsDefault || undefined"
      @click.stop="onTriggerClick(view.single, view.singleHref, $event)"
      @auxclick.stop="onTriggerAuxClick(view.single, view.singleHref, $event)"
    >
      <span
        v-if="view.single.icon"
        :class="['as-row-actions-btn-icon', view.single.icon]"
        aria-hidden="true"
      />
      <span v-else class="as-row-actions-btn-label">{{
        view.single.label || view.single.name
      }}</span>
    </component>
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
          :href-for="hrefFor"
          @select="trigger"
          @newtab="openNewTab"
        />
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </td>
</template>
