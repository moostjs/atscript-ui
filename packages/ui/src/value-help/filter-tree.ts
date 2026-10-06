import type { FilterExpr } from "@atscript/db-client";

/**
 * Plain-object view of an emitted `AtscriptQueryNode` (compiled `.as` or `/meta`):
 * a comparison `{ left, op, right? }` or `{ $and | $or | $not }`. A field ref is
 * `{ field }` (unqualified) or `{ type, field }`; only `field` matters here — a
 * value-help filter is scoped to the dictionary target by validation.
 */
type TTreeNode = Record<string, unknown>;

interface TFieldRef {
  field: string;
}

function isFieldRef(value: unknown): value is TFieldRef {
  return value !== null && typeof value === "object" && "field" in value;
}

/**
 * A deliberate copy of `translateQueryTree` from `@atscript/db`: that module is a
 * server-side runtime, and importing it would pull `@atscript/db` into the browser
 * bundle. `filter-tree.spec.ts` guards the two against drift.
 */
function translate(node: TTreeNode): FilterExpr {
  if (Array.isArray(node.$and)) return { $and: node.$and.map(translate) } as FilterExpr;
  if (Array.isArray(node.$or)) return { $or: node.$or.map(translate) } as FilterExpr;
  if (node.$not && typeof node.$not === "object") {
    return { $not: translate(node.$not as TTreeNode) } as FilterExpr;
  }
  const left = (node.left as TFieldRef).field;
  const op = node.op as string;
  const right = node.right;
  if (isFieldRef(right)) return { [left]: { [op]: { $field: right.field } } } as FilterExpr;
  if (op === "$exists") return { [left]: { $exists: right !== false } } as FilterExpr;
  return { [left]: { [op]: right } } as FilterExpr;
}

/**
 * Fields the tree pins to one value (`=` comparison against a literal) at its top-level
 * `and` chain. The runtime twin of `pinnedFields` in `plugin/value-help-validation.ts`
 * (which reads the source predicate) — keep the two rules in step.
 */
function pinnedOf(node: TTreeNode, out: string[]): void {
  if (Array.isArray(node.$and)) {
    for (const n of node.$and) pinnedOf(n as TTreeNode, out);
  } else if (node.left && node.op === "$eq" && !isFieldRef(node.right)) {
    out.push((node.left as TFieldRef).field);
  }
}

/**
 * Translates the static `filter` of a `@ui.valueHelp` binding into a Uniquery
 * `FilterExpr` (mirrors `translateQueryTree` of `@atscript/db`, with refs
 * resolved to the plain field path), plus the target fields it pins with `=` —
 * constant inside the picker, so their columns are hidden. Since 0.1.148.
 */
export function valueHelpFilter(tree: unknown): { filter: FilterExpr; pinned: string[] } {
  const pinned: string[] = [];
  pinnedOf(tree as TTreeNode, pinned);
  return { filter: translate(tree as TTreeNode), pinned: [...new Set(pinned)] };
}
