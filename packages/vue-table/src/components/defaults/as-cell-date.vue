<script lang="ts">
import { getDateTimeFormat } from "@atscript/ui-table";

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

// Formatter per (options, locale, zone) — a cell skips the options spread and
// the cache-key build of `getDateTimeFormat` on every render.
const formats = new Map<Intl.DateTimeFormatOptions, Map<string, Intl.DateTimeFormat>>();

function dateFormat(
  base: Intl.DateTimeFormatOptions,
  locale: string,
  tz: string | undefined,
): Intl.DateTimeFormat {
  let byKey = formats.get(base);
  if (!byKey) formats.set(base, (byKey = new Map()));
  const key = `${locale}|${tz ?? ""}`;
  let format = byKey.get(key);
  if (!format) {
    format = getDateTimeFormat(locale, tz ? { ...base, timeZone: tz } : base);
    byKey.set(key, format);
  }
  return format;
}
</script>

<script setup lang="ts">
import { computed } from "vue";
import { formatTimeAgoIntl } from "@vueuse/core";
import type { ColumnDef } from "@atscript/ui";
import { getCellValue } from "../../utils/get-cell-value";
import { useCellLocale } from "../../composables/use-cell-locale";

// `title` always carries the absolute ISO so e2e tests can grep the canonical
// timestamp regardless of locale/timezone-dependent rendered text.
const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

const { locale, timezone } = useCellLocale();

/** The cell's value as a Date, or `undefined` when it is empty / invalid / epoch. */
function toDate(v: unknown): Date | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isFinite(t) && t !== 0 ? v : undefined;
  }
  if (typeof v === "number" || typeof v === "string") {
    const d = new Date(v);
    const t = d.getTime();
    return Number.isFinite(t) && t !== 0 ? d : undefined;
  }
  return undefined;
}

// One computed per cell for both the shown text and the ISO `title`.
const view = computed(() => {
  const d = toDate(getCellValue(props.row, props.column.path));
  if (!d) return { text: "", title: "" };
  const title = d.toISOString();
  if (props.column.type === "relative") {
    return { text: formatTimeAgoIntl(d, { locale: locale.value }), title };
  }
  const base = props.column.type === "datetime" ? DATETIME_OPTS : DATE_OPTS;
  return { text: dateFormat(base, locale.value, timezone.value).format(d), title };
});
</script>

<template>
  <td :title="view.title">{{ view.text }}</td>
</template>
