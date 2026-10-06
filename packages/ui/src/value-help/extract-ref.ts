import type { TAtscriptAnnotatedType, TAtscriptTypeObject } from "@atscript/typescript/utils";
import { DB_HTTP_PATH, DB_REL_FK, UI_VALUE_HELP } from "../shared/annotation-keys";
import { valueHelpFilter } from "./filter-tree";
import type { ValueHelpInfo } from "./types";

/**
 * Hard cap on how many `.ref` hops the chain walk follows. Real chains are one
 * or two hops (view field → table field → dictionary); the cap is a backstop,
 * not a modelling limit — and it is also what terminates a cyclic chain.
 */
const MAX_REF_CHAIN_DEPTH = 8;

/**
 * `@db.http.path` of a binding target. Two producers, two shapes — `/meta`
 * deserialization does not normalize annotation values, so both are read here:
 *
 * - compiled `.as` (the atscript runtime): the annotated type itself (a class
 *   with a `metadata` Map) or a getter `() => Type` for a cross-file ref;
 * - `/meta` (the serialized type): a shallow target `{ id, metadata }` whose
 *   `metadata` is a plain record.
 *
 * Also accepts `{ type: () => Type }`.
 */
function bindingTargetPath(target: unknown): string | undefined {
  if (target === null || (typeof target !== "object" && typeof target !== "function")) {
    return undefined;
  }
  const t = target as { type?: unknown; metadata?: unknown };
  // A getter (`() => Type`) — a class (the annotated type itself) carries `metadata`.
  if (typeof target === "function" && t.metadata === undefined) {
    return bindingTargetPath((target as () => unknown)());
  }
  if (t.metadata instanceof Map) return t.metadata.get(DB_HTTP_PATH) as string | undefined;
  if (t.metadata && typeof t.metadata === "object") {
    return (t.metadata as Record<string, unknown>)[DB_HTTP_PATH] as string | undefined;
  }
  return t.type === undefined ? undefined : bindingTargetPath(t.type);
}

/**
 * The `@ui.valueHelp` binding of a node, when its target is served by a
 * controller (`@db.http.path`). Without a path the binding is ignored and the
 * caller falls back to the FK walk.
 */
function bindingInfo(node: TAtscriptAnnotatedType): ValueHelpInfo | undefined {
  const binding = node.metadata.get(UI_VALUE_HELP) as
    | { target?: unknown; field?: string; filter?: unknown }
    | undefined;
  if (!binding?.field) return undefined;
  const url = bindingTargetPath(binding.target);
  if (!url) return undefined;
  const info: ValueHelpInfo = { url, targetField: binding.field };
  if (binding.filter) {
    const { filter, pinned } = valueHelpFilter(binding.filter);
    info.filter = filter;
    if (pinned.length > 0) info.pinned = pinned;
  }
  return info;
}

/**
 * Synchronous probe. Returns `{ url, targetField }` for the first link of the
 * reference chain starting at `prop` that carries a `@ui.valueHelp` binding
 * (since 0.1.148 — an explicit binding beats `@db.rel.FK`, and also supplies
 * the static `filter` / `pinned` fields), or that satisfies all three conditions:
 *
 *   1. the link carries `@db.rel.FK`,
 *   2. the link has a `.ref`,
 *   3. the ref's target metadata carries `@db.http.path`.
 *
 * Since 0.1.134 the probe follows **reference chains**: when a link does not
 * qualify, it hops onto the referenced field (`ref.type()` → that object's
 * `props[ref.field]`) and re-tests. A view field declared as
 * `errorCode: Issue.errorCode`, where `Issue.errorCode: ErrorCode.code` is the
 * link carrying `@db.rel.FK`, therefore keeps its value help instead of losing
 * the dictionary.
 *
 * This mirrors what the server already does on the `/meta` path: since
 * `@atscript/db` 0.1.128 the serialized meta collapses such chains onto the
 * terminal field (`ref` → terminal, `db.rel.FK: true`), so a form def built
 * from `/meta` and one built from the compiled `.as` type land on the same
 * dictionary.
 *
 * The walk is bounded ({@link MAX_REF_CHAIN_DEPTH}), which is also what makes a
 * cyclic chain terminate (it runs out of hops and gives up instead of looping).
 * It stops as soon as a link has no `.ref`, or the referenced
 * field cannot be found — e.g. behind a shallow `{ id, metadata }` ref target
 * from `/meta`, which carries no props (and needs none: the server already
 * resolved the chain).
 */
export function extractValueHelp(prop: TAtscriptAnnotatedType): ValueHelpInfo | undefined {
  let node: TAtscriptAnnotatedType | undefined = prop;

  for (let depth = 0; node && depth < MAX_REF_CHAIN_DEPTH; depth++) {
    const bound = bindingInfo(node);
    if (bound) return bound;

    const ref: TAtscriptAnnotatedType["ref"] = node.ref;
    if (!ref) return undefined;

    const target: TAtscriptAnnotatedType | undefined = ref.type();
    if (!target) return undefined;

    if (node.metadata.has(DB_REL_FK)) {
      const url = target.metadata.get(DB_HTTP_PATH) as string | undefined;
      if (url) return { url, targetField: ref.field };
    }

    // Not a value-help link itself — hop onto the referenced field and re-test.
    const targetObject: TAtscriptTypeObject | undefined =
      target.type.kind === "object" ? (target.type as TAtscriptTypeObject) : undefined;
    node = targetObject?.props.get(ref.field);
  }

  return undefined;
}
