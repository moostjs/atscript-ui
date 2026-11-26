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

/** The top-level `and` chain of a tree, nested `$and`s flattened. */
function conjunctsOf(node: TTreeNode): TTreeNode[] {
  return Array.isArray(node.$and) ? node.$and.flatMap((n) => conjunctsOf(n as TTreeNode)) : [node];
}

/** A host reference: a top-level `targetField = Host.field` (a right-hand field ref). */
function isHostRef(node: TTreeNode): boolean {
  return !!node.left && node.op === "$eq" && isFieldRef(node.right);
}

/**
 * Translates the `filter` of a `@ui.valueHelp` binding into a Uniquery
 * `FilterExpr` (mirrors `translateQueryTree` of `@atscript/db`, with refs
 * resolved to the plain field path), plus the target fields it pins with `=`
 * against a literal — constant inside the picker, so their columns are hidden.
 * Since 0.1.148.
 *
 * Since 0.1.190 the host references (`targetField = Host.field`, top-level
 * conjuncts; position decides, the type of the reference is not read) are
 * lifted out into `hostFilter`: `filter` holds the literal comparisons only
 * (`undefined` when nothing else is left), so it never sends a field-to-field
 * comparison to the dictionary.
 *
 * `pinned` is the runtime twin of `pinnedFields` in
 * `plugin/value-help-validation.ts` (which reads the source predicate) — keep
 * the two rules in step.
 */
export function valueHelpFilter(tree: unknown): {
  filter?: FilterExpr;
  pinned: string[];
  hostFilter: { target: string; local: string }[];
} {
  const pinned: string[] = [];
  const hostFilter: { target: string; local: string }[] = [];
  const rest: FilterExpr[] = [];
  for (const node of conjunctsOf(tree as TTreeNode)) {
    const left = (node.left as TFieldRef | undefined)?.field;
    if (isHostRef(node)) {
      hostFilter.push({ target: left!, local: (node.right as TFieldRef).field });
      continue;
    }
    if (left !== undefined && node.op === "$eq" && !isFieldRef(node.right)) pinned.push(left);
    rest.push(translate(node));
  }
  const filter =
    rest.length === 0 ? undefined : rest.length === 1 ? rest[0] : ({ $and: rest } as FilterExpr);
  return { ...(filter && { filter }), pinned: [...new Set(pinned)], hostFilter };
}
