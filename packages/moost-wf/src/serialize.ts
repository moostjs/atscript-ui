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
 */
export function serializeFormSchema(type: TAtscriptAnnotatedType): unknown {
  const cached = schemaCache.get(type);
  if (cached) return cached;
  const schema = serializeAnnotatedType(type, {
    ignoreAnnotations: [WF_CONTEXT_PASS],
  });
  schemaCache.set(type, schema);
  return schema;
}
