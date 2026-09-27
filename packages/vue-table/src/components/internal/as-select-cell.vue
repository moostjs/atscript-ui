<script setup lang="ts">
import type { SelectionMode } from "@atscript/ui-table";
import type { RowSelectableVerdict, SelectOn } from "../../types";
import { useTableContextOptional } from "../../composables/use-table-state";
import { onSelectControlKeydown, toggleRowAt } from "../../composables/state/create-nav-controller";

/**
 * A row's selection cell, shared by `<AsTableBase>` and `<AsWindowTableBase>`:
 * the default `role="checkbox"` control, or the renderer's `cell-__select`
 * slot content, forwarded as this component's default slot.
 */
const props = defineProps<{
  row: Record<string, unknown>;
  /** Row index as the renderer counts it (absolute in window mode). */
  index: number;
  selected: boolean;
  verdict: RowSelectableVerdict;
  select: SelectionMode;
  selectOn: SelectOn;
}>();

const ctx = useTableContextOptional();

function toggle() {
  if (ctx) toggleRowAt(props.index, props.select, ctx.state);
}

/**
 * With `selectOn: "row"` the click bubbles to the row, which toggles; with
 * `"control"` it toggles here and stops, so the row click (active-row move,
 * `row-click`) and a double-click main action don't also fire.
 */
function onClick(event: MouseEvent) {
  if (props.selectOn !== "control") return;
  event.stopPropagation();
  toggle();
}

function onDblClick(event: MouseEvent) {
  if (props.selectOn === "control") event.stopPropagation();
}

function onKeydown(event: KeyboardEvent) {
  if (ctx) onSelectControlKeydown(event, props.index, props.select, ctx.state);
}

/** Accessible name for the control, carrying the disabled reason. */
function label(): string {
  if (props.verdict.ok) return "Select row";
  return props.verdict.reason
    ? `Select row, ${props.verdict.reason}`
    : "Select row, not selectable";
}
</script>

<template>
  <td class="as-td-select" role="gridcell">
    <slot
      :row="row"
      :index="index"
      :selected="selected"
      :selectable="verdict.ok"
      :reason="verdict.reason"
      :toggle="toggle"
    >
      <span
        class="as-table-checkbox"
        :class="{
          'as-table-checkbox-checked': selected,
          'as-table-checkbox-disabled': !verdict.ok,
        }"
        role="checkbox"
        :tabindex="verdict.ok ? 0 : undefined"
        :aria-checked="selected ? 'true' : 'false'"
        :aria-disabled="verdict.ok ? undefined : 'true'"
        :aria-label="label()"
        :title="verdict.reason"
        @click="onClick"
        @dblclick="onDblClick"
        @keydown="onKeydown"
      >
        <span v-if="selected" class="as-table-checkbox-tick" aria-hidden="true" />
      </span>
    </slot>
  </td>
</template>
