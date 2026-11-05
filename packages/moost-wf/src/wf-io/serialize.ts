import type { TAtscriptAnnotatedType, TSerializedAnnotatedType } from "@atscript/typescript/utils";
import { serializeAnnotatedType } from "@atscript/typescript/utils";
import { WF_CONTEXT_PASS } from "./context";
import { currentTranslation, localizeSchema } from "./i18n";

const schemaCache = new WeakMap<TAtscriptAnnotatedType, TSerializedAnnotatedType>();

/** Options of {@link serializeFormSchema}. */
export interface SerializeFormSchemaOpts {
  /**
   * Serve the schema in the request's language. Default `true`: with a
   * translator registered (moost's `setTranslator`) and a locale picked for
   * the request, the schema's texts (`@meta.label`, `@ui.form.placeholder`,
   * constraint messages, …) are translated and the schema carries `$i18n` —
   * the validator's and the UI components' message templates in that
   * language and the translated texts of its expressions. `false` serves the
   * source texts (e.g. when the wording depends on more than the locale).
   */
  translate?: boolean;
}

/**
 * Serialize an atscript annotated type to a JSON-transportable form schema.
 *
 * Delegates to `serializeAnnotatedType` from `@atscript/typescript`,
 * stripping server-only `@wf.context.pass` annotations from the output.
 * Results are cached per type identity — and, translated, per type and
 * locale (see {@link SerializeFormSchemaOpts.translate}). Without a
 * translator the result is the same object for every request.
 *
 * FK fields ship with a shallow ref: the target's identity (`id`) and
 * interface-level `metadata` (including `db.http.path` when present) are
 * included, but the target's structural body (`kind`, `props`, etc.) is
 * omitted. This is sufficient for client pickers to resolve value-help
 * endpoints without dragging the full target tree onto the wire. See the
 * `wf-serialize-shallow-ref` design for rationale.
 */
export function serializeFormSchema(
  type: TAtscriptAnnotatedType,
  opts?: SerializeFormSchemaOpts,
): unknown {
  let schema = schemaCache.get(type);
  if (!schema) {
    schema = serializeAnnotatedType(type, {
      ignoreAnnotations: [WF_CONTEXT_PASS],
      refDepth: 0.5,
    });
    schemaCache.set(type, schema);
  }
  const translation = opts?.translate === false ? undefined : currentTranslation();
  return translation ? localizeSchema(schema, translation) : schema;
}
