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

const value = computed(() => getCellValue(props.row, props.column.path));

const currency = computed(() => {
  const c = props.column.currencyCode;
  if (c) return c;
  const ref = props.column.currencyRefField;
  if (ref) {
    const v = props.row[ref];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
});

const unit = computed(() => {
  const u = props.column.unitCode;
  if (u) return u;
  const ref = props.column.unitRefField;
  if (ref) {
    const v = props.row[ref];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
});

const formatted = computed(() => {
  const v = value.value;
  if (v === null || v === undefined || v === "") return "";

  // Money wins over precisionScale (currency CLDR digits beat static config).
  // The helper passes `scale: undefined` when currency is set, so Intl uses
  // the currency's natural fraction digits.
  const cur = currency.value;
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
    unit: unit.value,
  });
  if (out !== "") return out;
  return typeof v === "string" ? v : String(v);
});
</script>

<template>
  <td class="as-cell-number as-cell-decimal">{{ formatted }}</td>
</template>
