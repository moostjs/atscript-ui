import type { ColumnDef } from "@atscript/ui";

const DEFAULT_WIDTHS: Record<string, string> = {
  boolean: "5em",
  number: "10em",
  date: "12em",
  text: "15em",
  array: "18em",
  object: "18em",
};

/** Returns column width from annotation or type-based default. */
export function getColumnWidth(column: ColumnDef): string {
  return column.width || DEFAULT_WIDTHS[column.type] || "15em";
}
