<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { getCellValue } from "../../utils/get-cell-value";
import { getNumberFormat } from "../../utils/intl-cache";
import { useCellLocale } from "../../composables/use-cell-locale";

// Money branch wins over precision — `Intl.NumberFormat` derives currency-
// specific fraction digits from CLDR, which beats a static `precisionScale`.
const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

const { locale } = useCellLocale();

const value = computed(() => getCellValue(props.row, props.column.path));

const numericValue = computed(() => {
  const v = value.value;
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
});

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
  const n = numericValue.value;
  if (n === undefined) {
    // Non-finite raw → render the raw string so malformed decimals are visible
    // instead of silently blanked.
    const v = value.value;
    if (v === null || v === undefined || v === "") return "";
    return String(v);
  }
  const cur = currency.value;
  if (cur) {
    // `Intl.NumberFormat` throws on a bad currency code; swallow so legacy /
    // user-injected codes don't break the row.
    try {
      return getNumberFormat(locale.value, { style: "currency", currency: cur }).format(n);
    } catch {
      // fall through to plain formatting
    }
  }
  const opts: Intl.NumberFormatOptions = {};
  if (props.column.precisionScale != null) {
    opts.minimumFractionDigits = props.column.precisionScale;
    opts.maximumFractionDigits = props.column.precisionScale;
  }
  const base = getNumberFormat(locale.value, opts).format(n);
  return unit.value ? `${base} ${unit.value}` : base;
});
</script>

<template>
  <td class="as-cell-number as-cell-decimal">{{ formatted }}</td>
</template>
