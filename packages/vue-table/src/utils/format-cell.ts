const numberFmt = new Intl.NumberFormat();
const dateFmt = new Intl.DateTimeFormat();

function str(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return `${value}`;
  }
  return JSON.stringify(value) ?? "";
}

/** Format a cell value based on column type. */
export function formatCellValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return "";
  switch (type) {
    case "boolean":
      return value ? "\u2713" : "\u2717";
    case "number":
      return typeof value === "number" ? numberFmt.format(value) : str(value);
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
