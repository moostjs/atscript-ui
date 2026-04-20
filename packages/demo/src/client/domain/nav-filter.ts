import type { DemoTable } from "./tables";

export type Perms = Record<string, { read: boolean; write: boolean; columns?: string[] }>;

export function filterNavByPermissions(tables: DemoTable[], perms?: Perms | null): DemoTable[] {
  if (!perms) return [];
  return tables.filter((t) => perms[t.resource]?.read);
}
