/** Gets a nested value from a row by dot-separated path. */
export function getCellValue(row: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const keys = path.split(".");
  let current: unknown = row;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
