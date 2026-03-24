import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { defineAnnotatedType } from "@atscript/typescript/utils";

// ── Programmatic type builders (for edge-case tests) ─────────

function annotate(h: ReturnType<typeof defineAnnotatedType>, meta?: Record<string, unknown>) {
  if (meta) {
    for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  }
}

export function stringProp(meta?: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("string");
  annotate(h, meta);
  return h.$type;
}

export function phantomProp(meta?: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("phantom");
  annotate(h, meta);
  return h.$type;
}

export function objectType(
  props: Record<string, TAtscriptAnnotatedType>,
  meta?: Record<string, unknown>,
) {
  const h = defineAnnotatedType("object");
  for (const [name, prop] of Object.entries(props)) h.prop(name, prop);
  annotate(h, meta);
  return h.$type;
}
