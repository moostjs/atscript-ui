import type { FilterExpr } from "@uniqu/core";

/**
 * AND-merge two filter expressions, producing a wire shape that survives
 * `@uniqu/url`'s `mergeConjunction` parser collapse.
 *
 * The collapse problem: when two `$and` siblings target the same field
 * with the same op (e.g. `{status: 'cancelled'}` AND `{status: 'shipped'}`),
 * the parser silently merges them on the receiving end and one clause is
 * dropped. This would let a colliding user-side filter erase a
 * `forceFilters` clause, breaking that contract.
 *
 * Fix: detect same-field same-op collisions and wrap each repeat in
 * `$not({$not: ...})`. `$not` nodes are preserved verbatim by the parser,
 * and `!!p ≡ p` is a semantic identity, so the server evaluator sees the
 * same AND. Non-colliding merges produce the canonical `$and` shape.
 */
export function mergeFilters(
  a: FilterExpr | undefined,
  b: FilterExpr | undefined,
): FilterExpr | undefined {
  if (!a) return b;
  if (!b) return a;
  return makeParserSafeAnd([a, b]);
}

/** Op-set for a field value: primitives are `$eq`, op-bags expose their keys. */
function getOpsForFieldValue(value: unknown): Set<string> {
  if (value === null || typeof value !== "object") return new Set(["$eq"]);
  return new Set(Object.keys(value as Record<string, unknown>));
}

/** True if `expr` has only field keys (no `$`-prefixed logical operators). */
function isComparisonNode(expr: FilterExpr): boolean {
  for (const k in expr) {
    if (k.startsWith("$")) return false;
  }
  return true;
}

/** Flatten nested `$and` so collision detection sees all sibling comparison nodes. */
function flattenAnd(children: FilterExpr[]): FilterExpr[] {
  const out: FilterExpr[] = [];
  for (const child of children) {
    if (
      child &&
      typeof child === "object" &&
      "$and" in child &&
      Array.isArray((child as { $and?: unknown[] }).$and)
    ) {
      out.push(...flattenAnd((child as { $and: FilterExpr[] }).$and));
    } else {
      out.push(child);
    }
  }
  return out;
}

function makeParserSafeAnd(children: FilterExpr[]): FilterExpr {
  const flat = flattenAnd(children);

  // Pass 1: detect colliding fields (same field, op-set intersects across
  // sibling comparison nodes). Non-comparison nodes (`$or`/`$not`/etc.) are
  // pass-through — the parser already preserves them.
  const fieldOps = new Map<string, Set<string>>();
  const collidingFields = new Set<string>();
  for (const node of flat) {
    if (!isComparisonNode(node)) continue;
    for (const f in node) {
      const ops = getOpsForFieldValue((node as Record<string, unknown>)[f]);
      const seen = fieldOps.get(f);
      if (!seen) {
        fieldOps.set(f, ops);
        continue;
      }
      for (const op of ops) {
        if (seen.has(op)) {
          collidingFields.add(f);
          break;
        }
      }
      for (const op of ops) seen.add(op);
    }
  }

  if (collidingFields.size === 0) return { $and: flat };

  // Pass 2: first occurrence per colliding field stays as-is; each repeat
  // is split out into its own `$not($not(...))` AND child.
  const seenColliding = new Set<string>();
  const out: FilterExpr[] = [];
  for (const node of flat) {
    if (!isComparisonNode(node)) {
      out.push(node);
      continue;
    }
    const safe: Record<string, unknown> = {};
    let safeHasKeys = false;
    for (const f in node) {
      const v = (node as Record<string, unknown>)[f];
      if (collidingFields.has(f) && seenColliding.has(f)) {
        out.push({ $not: { $not: { [f]: v } } } as FilterExpr);
      } else {
        safe[f] = v;
        safeHasKeys = true;
        if (collidingFields.has(f)) seenColliding.add(f);
      }
    }
    if (safeHasKeys) out.push(safe as FilterExpr);
  }

  return { $and: out };
}
