<script lang="ts">
import type { TFnScope } from "@atscript/ui-fns";

// Module-level singleton — shared across all AsField instances
const emptyScope: TFnScope = {
  v: undefined,
  data: {} as Record<string, unknown>,
  context: {} as Record<string, unknown>,
  entry: undefined,
};
</script>

<script setup lang="ts" generic="TFormData = any, TFormContext = any">
import { useFormField } from "../composables/use-form-field";
import {
  isObjectField,
  isArrayField,
  isUnionField,
  isTupleField,
  resolveFieldProp,
  resolveOptions,
  resolveAttrs,
  getFieldMeta,
  createFormData,
  createFormValueResolver,
  createFieldValidator,
  type FormFieldDef,
  type TFormAction,
} from "@atscript/ui";
import { buildFieldEntry } from "@atscript/ui-fns";
import { computed, inject, isRef, provide, watch, type Component, type ComputedRef } from "vue";
import { useFormContext } from "../composables/use-form-context";
import type { TAsChangeType } from "./types";

const props = defineProps<{
  field: FormFieldDef;
  error?: string;
  onRemove?: () => void;
  canRemove?: boolean;
  removeLabel?: string;
  arrayIndex?: number;
}>();

// ── Inject types, components, errors, action handler ─────────
const types = inject<ComputedRef<Record<string, Component>>>("__as_types");
const components = inject<ComputedRef<Record<string, Component> | undefined>>("__as_components");
const errors = inject<ComputedRef<Record<string, string | undefined> | undefined>>("__as_errors");
const handleAction = inject<(name: string) => void>("__as_action_handler", () => {});
const handleChange = inject<(type: TAsChangeType, path: string, value: unknown) => void>(
  "__as_change_handler",
  () => {},
);

// ── Form context ────────────────────────────────────────────
const { rootFormData, formContext, joinPath, buildPath, getByPath, setByPath, buildScope } =
  useFormContext<TFormData, TFormContext>("AsField");
const absolutePath = joinPath(() => props.field.path);

// ── Structured field detection ──────────────────────────────
const isStructured =
  isObjectField(props.field) || isArrayField(props.field) || isTupleField(props.field);
const isUnion = isUnionField(props.field);

// ── Nesting level tracking ──────────────────────────────────
const parentLevel = inject<ComputedRef<number>>(
  "__as_level",
  computed(() => -1),
);
const myLevel = isStructured ? parentLevel.value + 1 : -1;

// ── Provide path prefix + level for children (object/array/tuple/union)
// Union fields provide path prefix (children need correct path)
// but do NOT increment level (transparent wrapper — prevents double increment)
if (isStructured || isUnion) {
  provide(
    "__as_path_prefix",
    computed(() => absolutePath.value),
  );
}
if (isStructured) {
  provide(
    "__as_level",
    computed(() => myLevel),
  );
}

// Helper to unwrap value (handles both static and computed)
const unwrap = <T>(v: T | ComputedRef<T>): T => (isRef(v) ? v.value : v);

// Helper: returns a computed when dynamic, static value otherwise
function maybeComputed<T>(
  isDynamic: boolean,
  dynamicFn: () => T,
  staticVal: T,
): T | ComputedRef<T> {
  return isDynamic ? computed(dynamicFn) : staticVal;
}

// Helper to build the class object from a raw class value + state flags
function buildFieldClasses(
  classValue: unknown,
  isDisabled: boolean,
  isRequired: boolean,
): Record<string, boolean> {
  return {
    ...(typeof classValue === "string"
      ? { [classValue]: true }
      : (classValue as Record<string, boolean> | undefined)),
    disabled: isDisabled,
    required: isRequired,
  };
}

const prop = props.field.prop;

// ── Static reads (always) ──────────────────────────────────
const autocomplete = getFieldMeta(prop, "ui.autocomplete");
const maxLength = getFieldMeta(prop, "expect.maxLength")?.length;
const componentName = getFieldMeta(prop, "ui.component");
const formActionMeta = getFieldMeta(prop, "ui.form.action");
const formAction: TFormAction | undefined = formActionMeta
  ? {
      id: formActionMeta.id,
      label: formActionMeta.label ?? getFieldMeta(prop, "meta.label") ?? props.field.name,
    }
  : undefined;

// ── Cached validator (created once per field) ────────────────
const formValidate = createFieldValidator(
  prop,
  isStructured || isUnion ? { rootOnly: true } : undefined,
);

// ── Helpers for v-model with absolute path support ──────────
function getModel() {
  return getByPath(absolutePath.value);
}

function setModel(value: unknown) {
  setByPath(absolutePath.value, value);
}

// ── Optional toggle ─────────────────────────────────────────
function toggleOptional(enabled: boolean) {
  if (enabled) {
    const resolver = createFormValueResolver(
      rootFormData().value as Record<string, unknown>,
      formContext.value,
    );
    setModel(createFormData(props.field.prop, resolver).value);
  } else {
    setModel(undefined);
  }
  handleChange("update", absolutePath.value, getModel());
}

// ── Component resolution ────────────────────────────────────
const resolvedComponent = computed<Component | undefined>(() => {
  if (componentName) return components?.value?.[componentName];
  return types?.value?.[props.field.type];
});

// ── Declare all field properties ────────────────────────────
let disabled: boolean | ComputedRef<boolean>;
let hidden: boolean | ComputedRef<boolean>;
let optional: boolean | ComputedRef<boolean>;
let readonly: boolean | ComputedRef<boolean>;
let required: boolean | ComputedRef<boolean> | undefined;
let label: string | ComputedRef<string>;
let description: string | undefined | ComputedRef<string | undefined>;
let hint: string | undefined | ComputedRef<string | undefined>;
let placeholder: string | undefined | ComputedRef<string | undefined>;
let title: string | undefined | ComputedRef<string | undefined>;
let styles: unknown;
let options: ReturnType<typeof resolveOptions> | ComputedRef<ReturnType<typeof resolveOptions>>;
let attrs: Record<string, unknown> | ComputedRef<Record<string, unknown> | undefined> | undefined;
let classesBase: Record<string, boolean> | ComputedRef<Record<string, boolean>>;
let phantomValue: unknown;
let hasCustomValidators: boolean;

// Whether @meta.required is present (static — shared by both paths)
const hasMetaRequired = getFieldMeta(prop, "meta.required") !== undefined;

if (props.field.allStatic) {
  // ══════════════════════════════════════════════════════════
  // FAST PATH: all properties are static — no scope, no computeds
  // ══════════════════════════════════════════════════════════
  hasCustomValidators = false;

  // Constraints: static booleans
  disabled = getFieldMeta(prop, "ui.disabled") !== undefined;
  hidden = getFieldMeta(prop, "ui.hidden") !== undefined;
  optional = props.field.prop.optional ?? false;
  readonly = getFieldMeta(prop, "meta.readonly") !== undefined;

  // Required: based on @meta.required (skip for phantom)
  required = props.field.phantom ? undefined : hasMetaRequired;

  // Display: static reads
  label = getFieldMeta(prop, "meta.label") ?? props.field.name;
  description = getFieldMeta(prop, "meta.description");
  hint = getFieldMeta(prop, "ui.hint");
  placeholder = getFieldMeta(prop, "ui.placeholder");
  styles = getFieldMeta(prop, "ui.style");
  options = resolveOptions(prop, emptyScope);
  attrs = getFieldMeta(prop, "ui.attr") !== undefined ? resolveAttrs(prop, emptyScope) : undefined;

  // Title: static (for structure/array fields)
  title = isStructured ? (getFieldMeta(prop, "meta.label") ?? props.field.name) : undefined;

  // Classes: plain object (no computed)
  classesBase = buildFieldClasses(
    getFieldMeta(prop, "ui.class"),
    disabled as boolean,
    hasMetaRequired,
  );

  // Phantom value: static
  phantomValue = props.field.phantom ? getFieldMeta(prop, "meta.default") : undefined;
} else {
  // ══════════════════════════════════════════════════════════
  // DYNAMIC PATH: per-property static/dynamic detection
  // ══════════════════════════════════════════════════════════
  // Single scan of metadata keys to detect all ui.fn.* annotations
  const hasFn = new Set<string>();
  for (const key of (prop.metadata as unknown as { keys(): Iterable<string> }).keys()) {
    if (key.startsWith("ui.fn.")) hasFn.add(key.slice(6));
  }
  hasCustomValidators = getFieldMeta(prop, "ui.validate") !== undefined;

  // ── Lazy scope construction ────────────────────────────────
  const needsBaseScope = hasFn.has("disabled") || hasFn.has("hidden") || hasFn.has("readonly");
  const needsFullScope =
    hasFn.has("label") ||
    hasFn.has("description") ||
    hasFn.has("hint") ||
    hasFn.has("placeholder") ||
    hasFn.has("classes") ||
    hasFn.has("styles") ||
    hasFn.has("options") ||
    hasFn.has("value") ||
    hasFn.has("attr") ||
    hasFn.has("title") ||
    hasCustomValidators;
  const needsScope = needsBaseScope || needsFullScope;

  // Base scope for constraints (no entry)
  const baseScope = needsScope ? computed(() => buildScope(getModel())) : undefined;

  // Safe alias — guaranteed non-null when hasFn.has() is true (implies needsScope)
  const bs = baseScope as ComputedRef<TFnScope>;

  // ── Constraints (baseScope phase) ──────────────────────────
  const boolOpts = { staticAsBoolean: true } as const;

  disabled = maybeComputed(
    hasFn.has("disabled"),
    () =>
      resolveFieldProp<boolean>(prop, "ui.fn.disabled", "ui.disabled", bs.value, boolOpts) ?? false,
    getFieldMeta(prop, "ui.disabled") !== undefined,
  );

  hidden = maybeComputed(
    hasFn.has("hidden"),
    () => resolveFieldProp<boolean>(prop, "ui.fn.hidden", "ui.hidden", bs.value, boolOpts) ?? false,
    getFieldMeta(prop, "ui.hidden") !== undefined,
  );

  optional = props.field.prop.optional ?? false;

  readonly = maybeComputed(
    hasFn.has("readonly"),
    () =>
      resolveFieldProp<boolean>(prop, "ui.fn.readonly", "meta.readonly", bs.value, boolOpts) ??
      false,
    getFieldMeta(prop, "meta.readonly") !== undefined,
  );

  // Derived: required based on @meta.required (skip for phantom)
  required = props.field.phantom ? undefined : hasMetaRequired;

  // ── Full scope with entry (derived from baseScope) ─────────
  const scope = needsFullScope
    ? computed<TFnScope>(() =>
        buildFieldEntry(prop, bs.value, props.field.path, {
          type: props.field.type,
          component: componentName,
          name: props.field.name,
          optional: unwrap(optional),
          disabled: unwrap(disabled),
          hidden: unwrap(hidden),
          readonly: unwrap(readonly),
        }),
      )
    : undefined;

  // Safe alias — guaranteed non-null when hasFn.has() is true (implies needsFullScope)
  const fs = scope as ComputedRef<TFnScope>;

  // ── Display props (full scope phase) ───────────────────────
  label = maybeComputed(
    hasFn.has("label"),
    () => resolveFieldProp<string>(prop, "ui.fn.label", "meta.label", fs.value) ?? props.field.name,
    getFieldMeta(prop, "meta.label") ?? props.field.name,
  );

  description = maybeComputed(
    hasFn.has("description"),
    () => resolveFieldProp<string>(prop, "ui.fn.description", "meta.description", fs.value),
    getFieldMeta(prop, "meta.description"),
  );

  hint = maybeComputed(
    hasFn.has("hint"),
    () => resolveFieldProp<string>(prop, "ui.fn.hint", "ui.hint", fs.value),
    getFieldMeta(prop, "ui.hint"),
  );

  placeholder = maybeComputed(
    hasFn.has("placeholder"),
    () => resolveFieldProp<string>(prop, "ui.fn.placeholder", "ui.placeholder", fs.value),
    getFieldMeta(prop, "ui.placeholder"),
  );

  styles = maybeComputed(
    hasFn.has("styles"),
    () => resolveFieldProp(prop, "ui.fn.styles", "ui.style", fs.value),
    getFieldMeta(prop, "ui.style"),
  );

  options = maybeComputed(
    hasFn.has("options"),
    () => resolveOptions(prop, fs.value),
    resolveOptions(prop, emptyScope),
  );

  attrs =
    hasFn.has("attr") || getFieldMeta(prop, "ui.attr") !== undefined
      ? hasFn.has("attr")
        ? computed(() => resolveAttrs(prop, fs.value))
        : resolveAttrs(prop, emptyScope)
      : undefined;

  // ── Title (for structure/array fields) ─────────────────────
  title = isStructured
    ? maybeComputed(
        hasFn.has("title"),
        () =>
          resolveFieldProp<string>(prop, "ui.fn.title", "meta.label", fs.value) ?? props.field.name,
        getFieldMeta(prop, "meta.label") ?? props.field.name,
      )
    : undefined;

  // ── Classes — conditional computed ─────────────────────────
  classesBase =
    hasFn.has("classes") || typeof disabled !== "boolean"
      ? computed(() =>
          buildFieldClasses(
            hasFn.has("classes")
              ? resolveFieldProp(prop, "ui.fn.classes", undefined, fs.value)
              : getFieldMeta(prop, "ui.class"),
            unwrap(disabled),
            hasMetaRequired,
          ),
        )
      : buildFieldClasses(getFieldMeta(prop, "ui.class"), disabled as boolean, hasMetaRequired);

  // ── Phantom value (paragraph, action display) ──────────────
  phantomValue = props.field.phantom
    ? maybeComputed(
        hasFn.has("value"),
        () => resolveFieldProp(prop, "ui.fn.value", "meta.default", fs.value),
        getFieldMeta(prop, "meta.default"),
      )
    : undefined;

  // ── Readonly watcher (computed derived fields) ─────────────
  if (hasFn.has("value") && !props.field.phantom) {
    const computedValue = computed(() => {
      if (unwrap(readonly)) return resolveFieldProp(prop, "ui.fn.value", "meta.default", fs.value);
      return undefined;
    });

    watch(
      computedValue,
      (newVal) => {
        if (newVal !== undefined) {
          setByPath(absolutePath.value, newVal);
        }
      },
      { immediate: true },
    );
  }
}

// ── Validation rule (shared by both paths) ──────────────────
function formRule(v: unknown) {
  return formValidate(
    v,
    hasCustomValidators ? { data: rootFormData(), context: formContext.value } : undefined,
  );
}

// ── Field composable ────────────────────────────────────────
const {
  model,
  error: formError,
  onBlur: _onBlur,
} = useFormField({
  getValue: getModel,
  setValue: setModel,
  rules: [formRule],
  path: () => absolutePath.value,
  ...(props.field.prop.optional
    ? { resetValue: undefined }
    : isArrayField(props.field) || isTupleField(props.field)
      ? { resetValue: [] }
      : isObjectField(props.field)
        ? { resetValue: {} }
        : {}),
});

// Leaf fields emit 'update' on blur only when value changed since last emit.
let lastEmittedValue: unknown = model.value;
const onBlur =
  isStructured || isUnion
    ? _onBlur
    : () => {
        _onBlur();
        const current = model.value;
        if (current !== lastEmittedValue) {
          lastEmittedValue = current;
          handleChange("update", absolutePath.value, current);
        }
      };

// Merged error: external errors map > prop > form composable error
const mergedError = computed(() => {
  const path = buildPath(props.field.path);
  return (path ? errors?.value?.[path] : undefined) ?? props.error ?? formError.value;
});

// Stable model wrapper — plain object with getter/setter
const slotModel = {
  get value() {
    return model.value;
  },
  set value(v: unknown) {
    model.value = v;
  },
};

// ── Field-invariant props (setup-time constants) ──────────────
const invariantProps = {
  onBlur,
  model: slotModel,
  type: props.field.type,
  formAction,
  name: props.field.name,
  field: props.field,
  maxLength,
  autocomplete,
  level: isStructured ? myLevel : undefined,
};

// ── Display props — cached separately from error state ────────
// For allStatic fields this computed has zero reactive deps (evaluated
// once and cached). Error-only changes skip re-evaluating all unwrap() calls.
const displayProps = computed(() => ({
  value: unwrap(phantomValue),
  label: unwrap(label),
  description: unwrap(description),
  hint: unwrap(hint),
  placeholder: unwrap(placeholder),
  style: unwrap(styles),
  optional: unwrap(optional),
  onToggleOptional: unwrap(optional) ? toggleOptional : undefined,
  required: required !== undefined ? unwrap(required) : undefined,
  disabled: unwrap(disabled),
  hidden: unwrap(hidden),
  readonly: unwrap(readonly),
  options: unwrap(options),
  title: unwrap(title),
  onRemove: props.onRemove,
  canRemove: props.canRemove,
  removeLabel: props.removeLabel,
  arrayIndex: props.arrayIndex,
  ...unwrap(attrs),
}));

// ── Final component props — merges invariant + display + error state ──
const componentProps = computed(() => ({
  ...invariantProps,
  ...displayProps.value,
  error: mergedError.value,
  class: { ...unwrap(classesBase), error: !!mergedError.value },
}));
</script>

<template>
  <component
    v-if="resolvedComponent"
    :is="resolvedComponent"
    v-bind="componentProps"
    @action="handleAction"
  />
  <div v-else>
    [{{ unwrap(label) }}] No component for type "{{ field.type }}"{{
      componentName ? ` (component "${componentName}" not supplied)` : ""
    }}
  </div>
</template>
