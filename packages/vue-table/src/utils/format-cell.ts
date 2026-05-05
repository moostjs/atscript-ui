import { str } from "@atscript/ui";

const numberFmt = new Intl.NumberFormat();
const dateFmt = new Intl.DateTimeFormat();

/** Format a cell value based on column type. */
export function formatCellValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return "";
  switch (type) {
    case "boolean":
      return value ? "\u2713" : "\u2717";
    case "number": {
      // `decimal` fields arrive as strings on the wire (e.g. "19.99"); coerce
      // so the default cell doesn't regress to an unformatted string when no
      // <AsCellNumber> override is wired.
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? numberFmt.format(n) : str(value);
    }
    case "date": {
      if (value instanceof Date) return dateFmt.format(value);
      if (typeof value === "string" || typeof value === "number") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? str(value) : dateFmt.format(d);
      }
      return str(value);
    }
    case "array":
      return Array.isArray(value) ? `[${value.length}]` : str(value);
    case "object":
      return typeof value === "object" ? "[Object]" : str(value);
    default:
      return str(value);
  }
}
