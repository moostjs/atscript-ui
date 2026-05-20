import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { serializeAnnotatedType } from "@atscript/typescript/utils";
import { WF_CONTEXT_PASS } from "./context";

const schemaCache = new WeakMap<TAtscriptAnnotatedType, unknown>();

/**
 * Serialize an atscript annotated type to a JSON-transportable form schema.
 *
 * Delegates to `serializeAnnotatedType` from `@atscript/typescript`,
 * stripping server-only `@wf.context.pass` annotations from the output.
 * Results are cached per type identity.
 *
 * FK fields ship with a shallow ref: the target's identity (`id`) and
 * interface-level `metadata` (including `db.http.path` when present) are
 * included, but the target's structural body (`kind`, `props`, etc.) is
 * omitted. This is sufficient for client pickers to resolve value-help
 * endpoints without dragging the full target tree onto the wire. See the
 * `wf-serialize-shallow-ref` design for rationale.
 */
export function serializeFormSchema(type: TAtscriptAnnotatedType): unknown {
  const cached = schemaCache.get(type);
  if (cached) return cached;
  const schema = serializeAnnotatedType(type, {
    ignoreAnnotations: [WF_CONTEXT_PASS],
    refDepth: 0.5,
  });
  schemaCache.set(type, schema);
  return schema;
}
