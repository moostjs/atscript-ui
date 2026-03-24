import { defineAnnotatedType } from "@atscript/typescript/utils";

export function stringProp(meta?: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("string");
  if (meta) {
    for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  }
  return h.$type;
}

export function phantomProp(meta?: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("phantom");
  if (meta) {
    for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  }
  return h.$type;
}

export function objectType(
  props: Record<string, ReturnType<typeof stringProp>>,
  meta?: Record<string, unknown>,
) {
  const h = defineAnnotatedType("object");
  for (const [name, prop] of Object.entries(props)) h.prop(name, prop);
  if (meta) {
    for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  }
  return h.$type;
}
