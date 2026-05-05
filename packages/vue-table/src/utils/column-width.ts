import type { ColumnDef } from "@atscript/ui";

const DEFAULT_WIDTHS: Record<string, string> = {
  boolean: "5em",
  number: "10em",
  date: "13em",
  // Datetime renders the date plus `hour:minute` (e.g. "May 05, 2026, 01:50 PM")
  // — needs a few `em` more headroom than `date` to avoid mid-word ellipsis.
  datetime: "16em",
  // Relative ("3 days ago", "yesterday") is shorter than absolute datetime;
  // narrow it so it doesn't waste column space.
  relative: "11em",
  text: "15em",
  array: "18em",
  object: "18em",
};

/** Returns column width from annotation or type-based default. */
export function getColumnWidth(column: ColumnDef): string {
  return column.width || DEFAULT_WIDTHS[column.type] || "15em";
}
