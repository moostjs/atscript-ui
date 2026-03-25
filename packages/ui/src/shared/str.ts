/** Safely convert an unknown value to a string without triggering no-base-to-string lint errors. */
export function str(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return `${value}`;
  }
  return JSON.stringify(value) ?? "";
}
