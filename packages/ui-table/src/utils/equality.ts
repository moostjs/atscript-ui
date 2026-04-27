import type { SortControl } from "@atscript/ui";

export function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function sameColumnSet<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  const set = new Set<T>(a);
  for (const c of b) if (!set.has(c)) return false;
  return true;
}

export function sortersEqual(a: SortControl[], b: SortControl[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].field !== b[i].field || a[i].direction !== b[i].direction) return false;
  }
  return true;
}
