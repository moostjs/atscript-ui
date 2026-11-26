<script setup lang="ts">
import { ref, watch } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { optionValue } from "@atscript/ui";
import { isSimpleEq, sameColumnSet, type FilterCondition } from "@atscript/ui-table";
import type { Client } from "@atscript/db-client";
import type { ReactiveTableState } from "../../types";
import {
  createStaticTableState,
  provideTableContext,
  useTableContextOptional,
} from "../../composables/use-table-state";
import { createDistinctPager, valueColumn } from "../../composables/use-value-pickers";
import AsValueHelpTable from "./as-value-help-table.vue";
import { useAsTexts } from "@atscript/vue-form/locale";

const props = defineProps<{
  column: ColumnDef;
}>();
const texts = useAsTexts();
const { t } = texts;

const model = defineModel<FilterCondition[]>({ default: () => [] });

// The table this dialog belongs to — read before the inner state is provided below.
const outer = useTableContextOptional();
// Its pickers build their clients the way the table does.
const clientFactory = outer?.clientFactory;
// A dictionary target (FK or `@ui.valueHelp`): a full inner table, built by
// `AsValueHelpTable`. Its host references apply in forms only.
const info = props.column.valueHelpInfo;
// Distinct values of the column itself (`@ui.valueHelp.distinct`) read like an
// enum picker (one value column) but page + search on the server.
const distinct = props.column.distinct;
const options = props.column.options;

// A filter saved before the picker carried typed values (a URL, a preset) may hold the
// string form (`"true"`, `"1"`): read it as the option's typed value so it shows selected.
const typedByKey = options && new Map(options.map((o) => [o.key, optionValue(o)]));

function modelToValues(conds: FilterCondition[]): unknown[] {
  const values: unknown[] = [];
  for (const c of conds) {
    if (!isSimpleEq(c)) continue;
    const v = c.value[0];
    values.push(typedByKey && typeof v === "string" ? (typedByKey.get(v) ?? v) : v);
  }
  return values;
}
function valuesToModel(values: unknown[]): FilterCondition[] {
  const next: FilterCondition[] = [];
  for (const v of values) next.push({ type: "eq", value: [v as string | number | boolean] });
  return next;
}

// Single backing ref. Initialized from `model` once, then handed to the
// table state — `state.selectedRows === selectionRef` for the dialog's
// lifetime, so user toggles flow into this ref directly. The reverse
// direction (parent mutating `model` while the dialog is open) is not
// honoured: the dialog is the only writer for this column's filter.
const selectionRef = ref<unknown[]>(modelToValues(model.value));
// Handed to the dictionary table as the ref itself (a template unwraps a top-level ref).
const selection = { ref: selectionRef };

let innerState: ReactiveTableState | undefined;
if (!info && distinct) {
  const fetchPage = createDistinctPager(outer?.state, props.column, { texts, clientFactory });
  const { state } = createStaticTableState({
    rows: [],
    columns: [valueColumn(false, t)],
    searchPaths: ["__label"],
    // one page = one window block (100), so a follow-up block is the next page
    limit: 100,
    selection: {
      rowValueFn: (row) => row.__value,
      selectedRows: selectionRef,
    },
    remote: ({ searchTerm }, page, size) => fetchPage(searchTerm.trim(), page, size),
  });
  innerState = state;
} else if (!info && options) {
  const enumRows: Record<string, unknown>[] = options.map((o) => ({
    // The typed literal (`true`, `3`) — what the inline picker and the server use.
    __value: optionValue(o),
    __label: o.label,
  }));
  const enumColumns: ColumnDef[] = [valueColumn(true, t)];
  const { state } = createStaticTableState({
    rows: enumRows,
    columns: enumColumns,
    searchPaths: ["__label"],
    selection: {
      rowValueFn: (row) => row.__value,
      selectedRows: selectionRef,
    },
  });
  innerState = state;
}
// The enum and distinct pickers render their in-memory state through the same table.
if (innerState) provideTableContext({ state: innerState, client: {} as Client, controls: {} });

watch(selectionRef, (v) => {
  if (sameColumnSet(modelToValues(model.value), v)) return;
  model.value = valuesToModel(v);
});
</script>

<template>
  <AsValueHelpTable
    v-if="info"
    select="multi"
    :info="info"
    :selection="selection.ref"
    :client-factory="clientFactory"
  />
  <AsValueHelpTable v-else-if="innerState" select="multi" />
</template>
