import type { TAtscriptAnnotatedType, TAtscriptTypeObject } from "@atscript/typescript/utils";
import { DB_HTTP_PATH, DB_REL_FK } from "../shared/annotation-keys";
import type { ValueHelpInfo } from "./types";

/**
 * Hard cap on how many `.ref` hops the chain walk follows. Real chains are one
 * or two hops (view field → table field → dictionary); the cap is a backstop,
 * not a modelling limit — and it is also what terminates a cyclic chain.
 */
const MAX_REF_CHAIN_DEPTH = 8;

/**
 * Synchronous probe. Returns `{ url, targetField }` for the first link of the
 * reference chain starting at `prop` that satisfies all three conditions:
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
