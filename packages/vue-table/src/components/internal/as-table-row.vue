<script setup lang="ts">
import type { Component, Slots } from "vue";
import type { ColumnDef } from "@atscript/ui";
import type { RowClassHook, RowSelectableVerdict, SelectOn } from "../../types";
import type { CellResolver } from "../../composables/use-cell-resolver";
import { getCellValue } from "../../utils/get-cell-value";
import { displayCellValue } from "../../utils/display-cell-value";
import AsTableCellValue from "../defaults/as-table-cell-value.vue";
import AsSelectCell from "./as-select-cell.vue";
import { AsTableSlot } from "./as-table-slot";

/**
 * One standalone `<AsTableBase>` row. A component of its own so a change that
 * touches one row (active row, one selection) re-renders that row only —
 * every other row sees identical props and is skipped.
 *
 * The renderer's cell slots are rendered from `<AsTableBase>`'s `slots`
 * object (a prop, not forwarded slots — those would force every row to
 * update on each parent pass); `slotRev` moves whenever the consumer's slot
 * functions change, re-rendering every row exactly when the slot content
 * itself could have changed.
 *
 * @internal
 */
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  row: Record<string, unknown>;
  index: number;
  spaceBefore?: number;
  selectable: RowSelectableVerdict;
  rowClass: ReturnType<RowClassHook> | undefined;
  rowAttrs: Record<string, unknown> | undefined;
  selected: boolean;
  active: boolean;
  rowId: string | undefined;
  rowHeight?: number;
  hasValue: boolean;
  select: "none" | "single" | "multi";
  selectOn: SelectOn;
  columns: ColumnDef[];
  cellComponents: Record<string, Component>;
  cellSlotFlags: Record<string, boolean>;
  /** `<AsTableBase>`'s slots — the `cell-*` / `cell-__select` renderer slots. */
  slots: Slots;
  hasSelectSlot: boolean;
  /** Set only when some column carries cell bindings. */
  cellResolver?: CellResolver;
  stretch: boolean;
  slotRev: number;
  onRowClick: (row: Record<string, unknown>, event: MouseEvent, index: number) => void;
  onRowDblClick: (row: Record<string, unknown>, event: MouseEvent, index: number) => void;
}>();
</script>

<template>
  <!--
    `v-bind="rowAttrs"` comes FIRST so every framework binding after it wins —
    consumer attrs can decorate a row but can never rewrite its id / role /
    aria / data contract.
  -->
  <tr
    v-bind="rowAttrs"
    :id="rowId"
    :role="'row'"
    :aria-rowindex="index + 2"
    :aria-selected="select === 'none' ? undefined : selected ? 'true' : 'false'"
    :data-selectable="selectable.ok ? undefined : 'false'"
    :class="[{ 'as-table-row-active': active }, rowClass]"
    :style="{
      height: rowHeight ? `${rowHeight}px` : undefined,
      transform: spaceBefore ? `translateY(${spaceBefore}px)` : undefined,
    }"
    @click="onRowClick(row, $event, index)"
    @dblclick="onRowDblClick(row, $event, index)"
  >
    <AsSelectCell
      v-if="hasValue"
      :row="row"
      :index="index"
      :selected="selected"
      :verdict="selectable"
      :select="select"
      :select-on="selectOn"
    >
      <template v-if="hasSelectSlot" #default="scope">
        <AsTableSlot :slots="slots" name="cell-__select" :scope="scope" />
      </template>
    </AsSelectCell>
    <template v-if="cellResolver">
      <template v-for="col in columns" :key="col.path">
        <template v-for="bindings in [cellResolver(col, row, index)]" :key="0">
          <td v-if="cellSlotFlags[col.path]" role="gridcell" v-bind="bindings">
            <AsTableSlot
              :slots="slots"
              :name="`cell-${col.path}`"
              :scope="{ row, value: getCellValue(row, col.path), column: col }"
            />
          </td>
          <td
            v-else-if="cellComponents[col.path] === AsTableCellValue"
            :class="{ 'as-cell-number': col.type === 'number' }"
            role="gridcell"
            v-bind="bindings"
          >
            {{ displayCellValue(row, col) }}
          </td>
          <component
            v-else
            :is="cellComponents[col.path]"
            :row="row"
            :column="col"
            role="gridcell"
            v-bind="bindings"
          />
        </template>
      </template>
    </template>
    <template v-else>
      <template v-for="col in columns" :key="col.path">
        <td v-if="cellSlotFlags[col.path]" role="gridcell">
          <AsTableSlot
            :slots="slots"
            :name="`cell-${col.path}`"
            :scope="{ row, value: getCellValue(row, col.path), column: col }"
          />
        </td>
        <td
          v-else-if="cellComponents[col.path] === AsTableCellValue"
          :class="{ 'as-cell-number': col.type === 'number' }"
          role="gridcell"
        >
          {{ displayCellValue(row, col) }}
        </td>
        <component v-else :is="cellComponents[col.path]" :row="row" :column="col" role="gridcell" />
      </template>
    </template>
    <td v-if="stretch" class="as-td-filler" role="gridcell" />
  </tr>
</template>
