<script setup lang="ts">
// Class extractor safelist — runtime-composed classes (template-literal
// interpolation in <AsActionMenuItem> and <AsActionMenuContent> + dynamic
// `${prefix}-intent-${intent}` variants the build-time tokenizer can't see):
//   as-table-actions-menu
//   as-table-actions-menu-item
//   as-table-actions-menu-item-icon
//   as-table-actions-menu-item-label
//   as-table-actions-menu-separator
//   as-table-actions-intent-positive
//   as-table-actions-intent-negative
//   as-table-actions-intent-warning
//   as-table-actions-intent-primary
//   as-table-actions-intent-secondary
import { computed, ref, watch } from "vue";
import { DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from "reka-ui";
import { useTableContext } from "../composables/use-table-state";
import {
  applyRowGate,
  applyRowsGate,
  ariaLabelFor,
  collectIdentifiers,
  createNavigateGestures,
  intentClass,
  triggerAction,
} from "../composables/state/intent-scope";
import { rowActionHref } from "../composables/state/row-actions-config";
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
  ids: Record<string, unknown>[];
  /**
   * The row the `'row'` level resolved to — forwarded to `invoke` so a
   * client-only action's `onInvoke(row, pk)` and `href(row)` see it.
   */
  row?: Record<string, unknown>;
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

const preferredId = computed(() => state.tableDef.value?.preferredId ?? []);

const resolved = computed(() => {
  const r = resolveBuckets();
  const defaultHref = r.defaultAction
    ? rowActionHref(state, r.defaultAction, r.ids[0], r.row)
    : undefined;
  return {
    ...r,
    defaultHref,
    // No promptText → real anchor; with promptText the button stays (mod/middle
    // click on it still confirms → window.open via `defaultHref`).
    defaultAsLink: defaultHref !== undefined && !r.defaultAction?.promptText,
  };
});

function resolveBuckets(): Resolved {
  const selectedCount = state.selectedCount.value;
  const explicit = props.level;
  const effectiveLevel = resolveLevel(explicit, selectedCount);
  const pid = preferredId.value;

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
    // Resolve via `state.getActiveRow()` so the active row is read in the
    // right index space for the nav mode (see its definition). Hand-rolling
    // `results[activeIndex - resultsStart]` here was wrong on page ≥2.
    const source =
      explicit === "auto" && selectedCount === 1
        ? state.selectedRows.value[0]
        : state.getActiveRow();
    // Same `$actions` gate as the per-row dropdown — without it, the toolbar
    // would surface row actions the server has just disabled for that row.
    // Auto + 1 also surfaces bulk actions in the trailing menu so e.g.
    // "Suspend selected" stays reachable while the row default renders as
    // the CTA.
    // …and the same per-screen policy as the cell: one compiled view, so an
    // action the screen excluded or relabelled cannot come back here.
    const policy = state.rowActionsPolicy.value;
    const filtered = policy.apply(
      applyRowGate(
        {
          default: state.actions.default.row,
          others: state.actions.others.row,
          rows: explicit === "auto" && selectedCount === 1 ? state.actions.rows : [],
        },
        source,
      ),
    );
    const row = source as Record<string, unknown> | undefined;
    const extra = policy.extra(row);
    return collapseSingle({
      defaultAction: filtered.default,
      // Keep the source reference when there is nothing to append — consumers
      // compare array identity.
      otherActions: extra.length > 0 ? [...filtered.others, ...extra] : filtered.others,
      trailingRowActions: filtered.rows,
      level: "row",
      ids: collectIdentifiers(state, [source], pid),
      row,
    });
  }
  // Bulk gate = UNION of selected rows' `$actions` (shown when ≥1 selected
  // row allows it); the server still filters each row per-row at invoke.
  const filtered = applyRowsGate(
    {
      default: state.actions.default.rows,
      others: state.actions.others.rows,
      rows: [],
    },
    state.selectedRows.value,
  );
  return collapseSingle({
    defaultAction: filtered.default,
    otherActions: filtered.others,
    trailingRowActions: [],
    level: "rows",
    ids: collectIdentifiers(state, state.selectedRows.value, pid),
  });
}

const hasAny = computed(
  () =>
    resolved.value.defaultAction !== undefined ||
    resolved.value.otherActions.length > 0 ||
    resolved.value.trailingRowActions.length > 0,
);

function promptCtx() {
  return {
    identifiers: resolved.value.ids,
    preferredId: preferredId.value,
    row: resolved.value.row,
  };
}

async function invokeWith(action: TVueTableActionInfo, event?: MouseEvent | KeyboardEvent) {
  await triggerAction(state, action, promptCtx(), event);
}

/** Resolved navigate href for `action` against the toolbar's current ids. */
function hrefFor(action: TVueTableActionInfo): string | undefined {
  return rowActionHref(state, action, resolved.value.ids[0], resolved.value.row);
}

const { onTriggerClick, onTriggerAuxClick, openNewTab } = createNavigateGestures(
  state,
  promptCtx,
  hrefFor,
);

// ── Progress feedback ──────────────────────────────────────────────────────
//
// `state.actions.invoking` holds the names of the in-flight invocations. A
// running control is only marked visually today; screen readers got nothing,
// so the two additions here are `aria-busy` + a ", running" suffix on the
// ACCESSIBLE name (the visible label is untouched), and one polite live
// region that narrates start and settle. The region lives outside the default
// slot so it keeps announcing after the `…` menu — and any custom slot
// content — is gone.
const running = computed(() => state.actions.invoking.value);

function isRunning(action: TVueTableActionInfo | undefined): boolean {
  return action !== undefined && running.value.has(action.name);
}

/** Accessible name for a trigger, suffixed while its action is in flight. */
function triggerLabel(action: TVueTableActionInfo): string {
  const label = ariaLabelFor(action);
  return isRunning(action) ? `${label}, running` : label;
}

const menuBusy = computed(
  () =>
    resolved.value.otherActions.some((a) => isRunning(a)) ||
    resolved.value.trailingRowActions.some((a) => isRunning(a)),
);

const liveMessage = ref("");

// Labels are captured when an action STARTS: by the time it settles the
// toolbar may have resolved a different level (a bulk action clears the
// selection), so re-deriving the label at the end can come up empty.
const startedLabels = new Map<string, string>();

function labelOfName(name: string): string {
  const cached = startedLabels.get(name);
  if (cached !== undefined) return cached;
  for (const bucket of [state.actions.table, state.actions.row, state.actions.rows]) {
    for (const a of bucket) if (a.name === name) return ariaLabelFor(a);
  }
  return name;
}

watch(running, (next, prev) => {
  const before = prev ?? new Set<string>();
  for (const name of next) {
    if (before.has(name)) continue;
    const label = labelOfName(name);
    startedLabels.set(name, label);
    liveMessage.value = `${label} running`;
  }
  for (const name of before) {
    if (next.has(name)) continue;
    const label = labelOfName(name);
    startedLabels.delete(name);
    liveMessage.value = `${label} ${state.actions.lastResult.value.get(name)?.ok ? "finished" : "failed"}`;
  }
});
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
      <component
        :is="resolved.defaultAsLink ? 'a' : 'button'"
        v-if="resolved.defaultAction"
        :href="resolved.defaultAsLink ? resolved.defaultHref : undefined"
        :type="resolved.defaultAsLink ? undefined : 'button'"
        class="as-table-actions-btn"
        :class="intentClass('as-table-actions', resolved.defaultAction)"
        data-default
        :aria-label="triggerLabel(resolved.defaultAction)"
        :title="ariaLabelFor(resolved.defaultAction)"
        :aria-busy="isRunning(resolved.defaultAction) ? 'true' : undefined"
        @click="
          onTriggerClick(
            resolved.defaultAction,
            resolved.defaultHref,
            resolved.defaultAsLink,
            $event,
          )
        "
        @auxclick="
          onTriggerAuxClick(
            resolved.defaultAction,
            resolved.defaultHref,
            resolved.defaultAsLink,
            $event,
          )
        "
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
      </component>

      <DropdownMenuRoot
        v-if="resolved.otherActions.length > 0 || resolved.trailingRowActions.length > 0"
        :modal="false"
      >
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="as-table-actions-more"
            :aria-label="menuBusy ? 'More actions, running' : 'More actions'"
            title="More actions"
            :aria-busy="menuBusy ? 'true' : undefined"
          >
            <span class="i-as-menu" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <AsActionMenuContent
            :groups="[resolved.otherActions, resolved.trailingRowActions]"
            prefix="as-table-actions"
            :href-for="hrefFor"
            @select="invokeWith"
            @newtab="openNewTab"
          >
            <template v-if="$slots['menu-item']" #menu-item="slotProps">
              <slot name="menu-item" :action="slotProps.action" />
            </template>
          </AsActionMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </slot>
    <span class="sr-only" role="status" aria-live="polite">{{ liveMessage }}</span>
  </span>
</template>
