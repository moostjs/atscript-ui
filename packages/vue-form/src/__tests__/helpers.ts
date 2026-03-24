import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { defineAnnotatedType } from "@atscript/typescript/utils";
import { createFormDef, createFormData } from "@atscript/ui";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import AsForm from "../components/as-form.vue";
import { createDefaultTypes } from "../composables/create-default-types";

// ── Type builders (for tests that need inline types) ─────────

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

export function arrayType(itemType: TAtscriptAnnotatedType, meta?: Record<string, unknown>) {
  const h = defineAnnotatedType("array").of(itemType);
  annotate(h, meta);
  return h.$type;
}

// ── Mount helper ────────────────────────────────────────────

export function mountForm(
  type: TAtscriptAnnotatedType,
  opts?: {
    formContext?: Record<string, unknown>;
    components?: Record<string, unknown>;
    types?: Record<string, unknown>;
    errors?: Record<string, string>;
  },
) {
  const def = createFormDef(type);
  const formData = reactive(createFormData(type)) as { value: Record<string, any> };
  const types = (opts?.types ?? createDefaultTypes()) as any;

  const wrapper = mount(AsForm as any, {
    props: {
      def,
      formData,
      types,
      formContext: opts?.formContext,
      components: opts?.components,
      errors: opts?.errors,
    },
  });

  return { wrapper, def, formData };
}
