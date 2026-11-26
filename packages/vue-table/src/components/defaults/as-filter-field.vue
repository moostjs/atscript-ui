<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";
import { useAsTexts, useUiLocaleKey } from "@atscript/vue-form/locale";
import { useTableContext } from "../../composables/use-table-state";
import { useBoundSelectColumn } from "../../composables/use-value-pickers";
import AsFilterFieldBody from "../internal/as-filter-field-body.vue";

const props = defineProps<{
  column: ColumnDef;
}>();

// The body is rebuilt per UI locale (its key): its dictionary, distinct values
// and texts follow a switch — of `provideAsLocale` or of `setUiLocale`.
const texts = useAsTexts();
const locale = useUiLocaleKey(texts);
// A `select`-typed dictionary column picks from its values' checklist once they load (rebuilt then).
const picker = useBoundSelectColumn(() => props.column, {
  texts,
  clientFactory: useTableContext().clientFactory,
});
</script>

<template>
  <AsFilterFieldBody
    :key="`${locale ?? ''}${picker === column ? '' : '|options'}`"
    :column="picker ?? column"
  />
</template>
