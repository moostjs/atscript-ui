<script setup lang="ts">
import { computed } from "vue";
import { formatTimeAgoIntl } from "@vueuse/core";
import type { ColumnDef } from "@atscript/ui";
import { getCellValue } from "../../utils/get-cell-value";
import { getDateTimeFormat } from "../../utils/intl-cache";
import { useCellLocale } from "../../composables/use-cell-locale";

// `title` always carries the absolute ISO so e2e tests can grep the canonical
// timestamp regardless of locale/timezone-dependent rendered text.
const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

const { locale, timezone } = useCellLocale();

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "2-digit",
};
const DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTS,
  hour: "2-digit",
  minute: "2-digit",
};

const date = computed<Date | undefined>(() => {
  const v = getCellValue(props.row, props.column.path);
  if (v === null || v === undefined || v === "") return undefined;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : undefined;
  if (typeof v === "number" || typeof v === "string") {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : undefined;
  }
  return undefined;
});

const formatted = computed(() => {
  const d = date.value;
  if (!d) return "";
  if (props.column.type === "relative") return formatTimeAgoIntl(d, { locale: locale.value });
  const tz = timezone.value;
  const base = props.column.type === "datetime" ? DATETIME_OPTS : DATE_OPTS;
  const opts = tz ? { ...base, timeZone: tz } : base;
  return getDateTimeFormat(locale.value, opts).format(d);
});
</script>

<template>
  <td :title="date?.toISOString() ?? ''">{{ formatted }}</td>
</template>
