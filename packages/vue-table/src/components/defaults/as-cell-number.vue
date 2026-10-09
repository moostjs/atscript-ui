<script setup lang="ts">
import { computed } from "vue";
import { type ColumnDef, formatDecimalForDisplay } from "@atscript/ui";
import { getCellValue } from "../../utils/get-cell-value";
import { useCellLocale } from "../../composables/use-cell-locale";

// Money branch wins over precision — `Intl.NumberFormat` derives currency-
// specific fraction digits from CLDR, which beats a static `precisionScale`.
// Single source of truth for decimal formatting lives in
// `@atscript/ui/decimal-format` so form composables and table cells render
// identically — see `formatDecimalForDisplay`.
const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

const { locale } = useCellLocale();

// One computed per cell: the value, the currency / unit (static or per-row
// ref field) and the formatting are all read here.
const formatted = computed(() => {
  const v = getCellValue(props.row, props.column.path);
  if (v === null || v === undefined || v === "") return "";

  // Money wins over precisionScale (currency CLDR digits beat static config).
  // The helper passes `scale: undefined` when currency is set, so Intl uses
  // the currency's natural fraction digits.
  const cur = refCode(props.column.currencyCode, props.column.currencyRefField);
  if (cur) {
    const out = formatDecimalForDisplay({ value: v, locale: locale.value, currency: cur });
    if (out !== "") return out;
    // Non-finite raw → render raw string so malformed decimals stay visible.
    return typeof v === "string" ? v : String(v);
  }
  // Grouping defaults are derived inside `formatDecimalForDisplay`.
  const out = formatDecimalForDisplay({
    value: v,
    scale: props.column.precisionScale,
    locale: locale.value,
    unit: refCode(props.column.unitCode, props.column.unitRefField),
  });
  if (out !== "") return out;
  return typeof v === "string" ? v : String(v);
});

/** A static code, else a non-empty string read from the row's ref field. */
function refCode(code: string | undefined, refField: string | undefined): string | undefined {
  if (code) return code;
  if (refField) {
    const v = props.row[refField];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}
</script>

<template>
  <td class="as-cell-number as-cell-decimal">{{ formatted }}</td>
</template>
