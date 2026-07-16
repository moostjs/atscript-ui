/** Converts a dot-path to a human-readable label (e.g. 'firstName' → 'First Name'). */
export function humanizePath(path: string): string {
  const last = path.slice(path.lastIndexOf(".") + 1);
  return last.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase());
}

/** Safely convert an unknown value to a string without triggering no-base-to-string lint errors. */
export function str(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return `${value}`;
  }
  return JSON.stringify(value) ?? "";
}
