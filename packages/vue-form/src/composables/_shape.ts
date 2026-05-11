/**
 * Match the input shape on commit: `null`/`undefined` model → write the
 * canonical string (first-ever commit); pre-existing string → string;
 * pre-existing number → number (caller opted into float; the precision
 * loss is on them).
 *
 * Shared by `useAsDecimal` and `useAsNumber`. Not exported from the
 * package barrel — internal helper, no public surface.
 */
export function preserveShape(
  original: string | number | null | undefined,
  normalized: string,
): string | number {
  if (original === null || original === undefined) return normalized;
  if (typeof original === "string") return normalized;
  return Number(normalized);
}
