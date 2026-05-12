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
import { useAsField } from "../composables/use-as-field";
import {
  isObjectField,
  isArrayField,
  isUnionField,
  isTupleField,
  resolveFieldProp,
  resolveOptions,
  resolveAttrs,
  resolveSingularLabel,
  getFieldMeta,
  createFormData,
  createFormValueResolver,
  createFieldValidator,
  buildGridClasses,
  resolveGridSpec,
  extractValueHelp,
  getCurrencyDecimals,
  getCurrencyDisplayParts,
  DB_AMOUNT_CURRENCY,
  DB_AMOUNT_CURRENCY_REF,
  DB_COLUMN_PRECISION,
  DB_UNIT,
  DB_UNIT_REF,
  EXPECT_MAX_LENGTH,
  META_DEFAULT,
  META_DESCRIPTION,
  META_LABEL,
  META_READONLY,
  META_REQUIRED,
  UI_FORM_ACTION,
  UI_FORM_ATTR,
  UI_FORM_AUTOCOMPLETE,
  UI_FORM_CLASSES,
  UI_FORM_COMPONENT,
  UI_FORM_DISABLED,
  UI_FORM_FN_CLASSES,
  UI_FORM_FN_DESCRIPTION,
  UI_FORM_FN_DISABLED,
  UI_FORM_FN_HIDDEN,
  UI_FORM_FN_HINT,
  UI_FORM_FN_LABEL,
  UI_FORM_FN_PLACEHOLDER,
  UI_FORM_FN_PREFIX,
  UI_FORM_FN_READONLY,
  UI_FORM_FN_STYLES,
  UI_FORM_FN_TITLE,
  UI_FORM_FN_VALUE,
  UI_FORM_GRID_COL_SPAN,
  UI_FORM_GRID_ROW_SPAN,
  UI_FORM_HIDDEN,
  UI_FORM_HINT,
  UI_FORM_PLACEHOLDER,
  UI_FORM_PREFIX,
  UI_FORM_PREFIX_ICON,
  UI_FORM_PREFIX_REF,
  UI_FORM_STYLES,
  UI_FORM_SUFFIX,
  UI_FORM_SUFFIX_ICON,
  UI_FORM_SUFFIX_REF,
  UI_FORM_VALIDATE,
  WF_ACTION_WITH_DATA,
  type FormFieldDef,
  type TFormAction,
} from "@atscript/ui";
import { useAsData } from "../composables/use-as-data";
import { useAsLocale } from "../composables/use-as-locale";
import { buildFieldEntry } from "@atscript/ui-fns";
import {
  computed,
  inject,
  isRef,
  provide,
  useId,
  watch,
  type Component,
  type ComputedRef,
} from "vue";
import {
  ACTION_HANDLER_KEY,
  CHANGE_HANDLER_KEY,
  COMPONENTS_KEY,
  DISMISS_EXTERNAL_AT_KEY,
  ERRORS_KEY,
  HIDE_ROOT_TITLE_KEY,
  LEVEL_KEY,
  PATH_PREFIX_KEY,
  TYPES_KEY,
} from "../composables/internal-keys";
import { useFormContext } from "../composables/use-form-context";

const props = defineProps<{
  field: FormFieldDef;
  error?: string;
  onRemove?: () => void;
  canRemove?: boolean;
  removeLabel?: string;
  arrayIndex?: number;
}>();

// ── Inject types, components, errors, action handler ─────────
const types = inject(TYPES_KEY);
const components = inject(COMPONENTS_KEY);
const errors = inject(ERRORS_KEY);
const hideRootTitle = inject(HIDE_ROOT_TITLE_KEY, false);
const handleAction = inject(ACTION_HANDLER_KEY, () => {});
const handleChange = inject(CHANGE_HANDLER_KEY, () => {});
const dismissExternalAt = inject(DISMISS_EXTERNAL_AT_KEY, () => {});

// ── Form context ────────────────────────────────────────────
const { rootFormData, formContext, joinPath, buildPath, getByPath, setByPath, buildScope } =
  useFormContext<TFormData, TFormContext>("AsField");
const absolutePath = joinPath(() => props.field.path);

// ── Structured field detection ──────────────────────────────
const isStructured =
  isObjectField(props.field) || isArrayField(props.field) || isTupleField(props.field);
const isUnion = isUnionField(props.field);

// ── Nesting level tracking ──────────────────────────────────
const parentLevel = inject(
  LEVEL_KEY,
  computed(() => -1),
);
const myLevel = isStructured || isUnion ? parentLevel.value + 1 : -1;

// Union fields take a level slot too — AsUnion dispatches the variant's
// component (AsObject / AsArray / etc.) directly, so the variant's chrome
// must render at the union's own depth (not as root).
if (isStructured || isUnion) {
  provide(
    PATH_PREFIX_KEY,
    computed(() => absolutePath.value),
  );
  provide(
    LEVEL_KEY,
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

// Optional+required is intentionally treated as not-required here: undefined
// passes validation, so the `*` marker would mislead the user.
function buildFieldClasses(
  classValue: unknown,
  isDisabled: boolean,
  isRequired: boolean,
  isOptional: boolean,
): Record<string, boolean> {
  return {
    ...(typeof classValue === "string"
      ? { [classValue]: true }
      : (classValue as Record<string, boolean> | undefined)),
    disabled: isDisabled,
    required: isRequired && !isOptional,
  };
}

const prop = props.field.prop;

// ── Static reads (always) ──────────────────────────────────
const autocomplete = getFieldMeta(prop, UI_FORM_AUTOCOMPLETE);
const maxLength = getFieldMeta(prop, EXPECT_MAX_LENGTH)?.length;
const componentName = getFieldMeta(prop, UI_FORM_COMPONENT);
const prefixIcon = getFieldMeta(prop, UI_FORM_PREFIX_ICON);
const suffixIcon = getFieldMeta(prop, UI_FORM_SUFFIX_ICON);

// ── Resolved annotation reads — done once at setup, surfaced to defaults ──
// Defaults read these as plain props instead of touching `field.prop`,
// so a custom swap component does not need to know about annotations.
const valueHelp = extractValueHelp(prop);

// ── Measurement / adornment resolution (sibling-ref aware) ────
// Raw annotation reads (one-shot — these are static keys).
const currencyLiteral = getFieldMeta(prop, DB_AMOUNT_CURRENCY) as string | undefined;
const currencyRefField = getFieldMeta(prop, DB_AMOUNT_CURRENCY_REF) as string | undefined;
const unitLiteral = getFieldMeta(prop, DB_UNIT) as string | undefined;
const unitRefField = getFieldMeta(prop, DB_UNIT_REF) as string | undefined;
const prefixLiteral = getFieldMeta(prop, UI_FORM_PREFIX) as string | undefined;
const prefixRefField = getFieldMeta(prop, UI_FORM_PREFIX_REF) as string | undefined;
const suffixLiteral = getFieldMeta(prop, UI_FORM_SUFFIX) as string | undefined;
const suffixRefField = getFieldMeta(prop, UI_FORM_SUFFIX_REF) as string | undefined;
const precisionMeta = getFieldMeta(prop, DB_COLUMN_PRECISION) as
  | { precision: number; scale: number }
  | undefined;
const precisionScale = precisionMeta?.scale;

// Whether the field carries ANY adornment-driving annotation. Surfaces as
// `hasAdornment` on `TAsComponentProps` so AsNumber / AsDecimal can render
// the merged-chrome shell consistently even when a sibling-ref source is
// currently empty (otherwise the shell would flicker on/off as the user
// selected the source value). Static value at AsField setup — never
// changes for a given mount.
//
// Also gates the data + locale wiring below — avoids the reactive
// subscribe cost on every form field, structured field, or action.
const hasAdornment =
  currencyLiteral !== undefined ||
  currencyRefField !== undefined ||
  unitLiteral !== undefined ||
  unitRefField !== undefined ||
  prefixLiteral !== undefined ||
  prefixRefField !== undefined ||
  prefixIcon !== undefined ||
  suffixLiteral !== undefined ||
  suffixRefField !== undefined ||
  suffixIcon !== undefined;

let resolvedCurrencyCode: string | ComputedRef<string | undefined> | undefined;
let resolvedUnitCode: string | ComputedRef<string | undefined> | undefined;
let resolvedPrefix: string | ComputedRef<string | undefined> | undefined;
let resolvedSuffix: string | ComputedRef<string | undefined> | undefined;
let resolvedScale: number | ComputedRef<number | undefined> | undefined;

if (hasAdornment) {
  const _data = useAsData();
  const { locale: _locale } = useAsLocale();

  // Currency: literal wins; otherwise sibling-ref read.
  if (currencyLiteral !== undefined) {
    resolvedCurrencyCode = currencyLiteral;
  } else if (currencyRefField !== undefined) {
    const ref = _data.siblingValue<string>(currencyRefField);
    resolvedCurrencyCode = computed<string | undefined>(() => {
      const v = ref.value;
      return typeof v === "string" && v.length > 0 ? v : undefined;
    });
  }

  // Unit: literal wins; otherwise sibling-ref read.
  if (unitLiteral !== undefined) {
    resolvedUnitCode = unitLiteral;
  } else if (unitRefField !== undefined) {
    const ref = _data.siblingValue<string>(unitRefField);
    resolvedUnitCode = computed<string | undefined>(() => {
      const v = ref.value;
      return typeof v === "string" && v.length > 0 ? v : undefined;
    });
  }

  // Reads the current resolved currency/unit code through whichever shape
  // (literal string vs `computed<string | undefined>`) it landed in above.
  const readCode = (v: string | ComputedRef<string | undefined> | undefined): string | undefined =>
    isRef(v) ? v.value : v;

  // Prefix: explicit @ui.form.prefix wins → .ref → currency narrow symbol.
  const prefixRefValue = prefixRefField ? _data.siblingValue<string>(prefixRefField) : undefined;
  resolvedPrefix = computed<string | undefined>(() => {
    if (prefixLiteral !== undefined && prefixLiteral.length > 0) return prefixLiteral;
    if (prefixRefValue) {
      const v = prefixRefValue.value;
      if (typeof v === "string" && v.length > 0) return v;
    }
    // Fall back to currency symbol when resolved.
    const code = readCode(resolvedCurrencyCode);
    if (code) return getCurrencyDisplayParts(code, _locale.value).symbol;
    return undefined;
  });

  // Suffix: explicit @ui.form.suffix wins → .ref → unit code.
  const suffixRefValue = suffixRefField ? _data.siblingValue<string>(suffixRefField) : undefined;
  resolvedSuffix = computed<string | undefined>(() => {
    if (suffixLiteral !== undefined && suffixLiteral.length > 0) return suffixLiteral;
    if (suffixRefValue) {
      const v = suffixRefValue.value;
      if (typeof v === "string" && v.length > 0) return v;
    }
    return readCode(resolvedUnitCode);
  });

  // Effective display scale: min(currencyDecimals, precisionScale) when
  // currency known; else currencyDecimals; else precisionScale; else undef.
  resolvedScale = computed<number | undefined>(() => {
    const code = readCode(resolvedCurrencyCode);
    const currDecimals = code ? getCurrencyDecimals(code, _locale.value) : undefined;
    if (currDecimals !== undefined && typeof precisionScale === "number") {
      return Math.min(currDecimals, precisionScale);
    }
    if (currDecimals !== undefined) return currDecimals;
    if (typeof precisionScale === "number") return precisionScale;
    return undefined;
  });
}
// `@ui.form.label.singular` lives on the array prop; fall back to the
// item prop, then to "item". The fallback chain matches AsArray's prior
// behaviour — default lookup yields "item" only when both lookups miss.
let singularLabel: string | undefined;
if (isArrayField(props.field)) {
  const fromArray = resolveSingularLabel(prop);
  singularLabel =
    fromArray !== "item" ? fromArray : resolveSingularLabel(props.field.itemField.prop);
}

// ── Stable a11y ids (one trio per AsField mount, shared with defaults) ──
const _id = useId();
const inputId = `as-field-${_id}`;
const errorId = `${inputId}-err`;
const descId = `${inputId}-desc`;
const formActionMeta = getFieldMeta(prop, UI_FORM_ACTION);
const wfActionWithData = getFieldMeta(prop, WF_ACTION_WITH_DATA) as string | undefined;
const formAction: TFormAction | undefined = formActionMeta
  ? {
      id: formActionMeta.id,
      label: formActionMeta.label ?? getFieldMeta(prop, META_LABEL) ?? props.field.name,
    }
  : wfActionWithData
    ? { id: wfActionWithData, label: getFieldMeta(prop, META_LABEL) ?? props.field.name }
    : undefined;

// ── Grid footprint (static — annotations are read-once) ─────
// `as-grid-item` already covers the col=12/row=1 default; only emit
// classes when the spec deviates from default.
const gridClasses = buildGridClasses(
  resolveGridSpec(
    getFieldMeta(prop, UI_FORM_GRID_COL_SPAN),
    getFieldMeta(prop, UI_FORM_GRID_ROW_SPAN),
  ),
);

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
// Precedence: @ui.form.component (named) > @ui.form.type / @ui.type
// (structured-kind override stored as `customType`) > the field's
// structural `type`. For primitives `customType` is undefined — the
// `@ui.form.type` value was folded into `type` directly at create-def
// time, so the existing single-key lookup still matches.
const resolvedComponent = computed<Component | undefined>(() => {
  if (componentName) return components?.value?.[componentName];
  const map = types?.value;
  if (!map) return undefined;
  return (
    (props.field.customType ? map[props.field.customType] : undefined) ?? map[props.field.type]
  );
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
const hasMetaRequired = getFieldMeta(prop, META_REQUIRED) !== undefined;

if (props.field.allStatic) {
  // Fast path: no fn keys → no scope, no computeds.
  hasCustomValidators = false;

  // Constraints: static booleans
  disabled = getFieldMeta(prop, UI_FORM_DISABLED) !== undefined;
  hidden = getFieldMeta(prop, UI_FORM_HIDDEN) !== undefined;
  optional = props.field.prop.optional ?? false;
  readonly = getFieldMeta(prop, META_READONLY) !== undefined;

  // Required: based on @meta.required (skip for phantom)
  required = props.field.phantom ? undefined : hasMetaRequired;

  // Display: static reads
  label = getFieldMeta(prop, META_LABEL) ?? props.field.name;
  description = getFieldMeta(prop, META_DESCRIPTION);
  hint = getFieldMeta(prop, UI_FORM_HINT);
  placeholder = getFieldMeta(prop, UI_FORM_PLACEHOLDER);
  styles = getFieldMeta(prop, UI_FORM_STYLES);
  options = resolveOptions(prop, emptyScope);
  attrs =
    getFieldMeta(prop, UI_FORM_ATTR) !== undefined ? resolveAttrs(prop, emptyScope) : undefined;

  // Title: static (for structure/array/union fields)
  title =
    isStructured || isUnion ? (getFieldMeta(prop, META_LABEL) ?? props.field.name) : undefined;

  // Classes: plain object (no computed)
  classesBase = buildFieldClasses(
    getFieldMeta(prop, UI_FORM_CLASSES),
    disabled as boolean,
    hasMetaRequired,
    optional as boolean,
  );

  // Phantom value: static
  phantomValue = props.field.phantom ? getFieldMeta(prop, META_DEFAULT) : undefined;
} else {
  // Dynamic path. One pass over metadata keys so per-property static-vs-dynamic
  // branching costs O(N), not O(N × per-key getFieldMeta calls).
  const hasFn = new Set<string>();
  for (const key of prop.metadata.keys()) {
    const k = key as string;
    if (k.startsWith(UI_FORM_FN_PREFIX)) hasFn.add(k.slice(UI_FORM_FN_PREFIX.length));
  }
  hasCustomValidators = getFieldMeta(prop, UI_FORM_VALIDATE) !== undefined;

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
      resolveFieldProp<boolean>(prop, UI_FORM_FN_DISABLED, UI_FORM_DISABLED, bs.value, boolOpts) ??
      false,
    getFieldMeta(prop, UI_FORM_DISABLED) !== undefined,
  );

  hidden = maybeComputed(
    hasFn.has("hidden"),
    () =>
      resolveFieldProp<boolean>(prop, UI_FORM_FN_HIDDEN, UI_FORM_HIDDEN, bs.value, boolOpts) ??
      false,
    getFieldMeta(prop, UI_FORM_HIDDEN) !== undefined,
  );

  optional = props.field.prop.optional ?? false;

  readonly = maybeComputed(
    hasFn.has("readonly"),
    () =>
      resolveFieldProp<boolean>(prop, UI_FORM_FN_READONLY, META_READONLY, bs.value, boolOpts) ??
      false,
    getFieldMeta(prop, META_READONLY) !== undefined,
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
    () =>
      resolveFieldProp<string>(prop, UI_FORM_FN_LABEL, META_LABEL, fs.value) ?? props.field.name,
    getFieldMeta(prop, META_LABEL) ?? props.field.name,
  );

  description = maybeComputed(
    hasFn.has("description"),
    () => resolveFieldProp<string>(prop, UI_FORM_FN_DESCRIPTION, META_DESCRIPTION, fs.value),
    getFieldMeta(prop, META_DESCRIPTION),
  );

  hint = maybeComputed(
    hasFn.has("hint"),
    () => resolveFieldProp<string>(prop, UI_FORM_FN_HINT, UI_FORM_HINT, fs.value),
    getFieldMeta(prop, UI_FORM_HINT),
  );

  placeholder = maybeComputed(
    hasFn.has("placeholder"),
    () => resolveFieldProp<string>(prop, UI_FORM_FN_PLACEHOLDER, UI_FORM_PLACEHOLDER, fs.value),
    getFieldMeta(prop, UI_FORM_PLACEHOLDER),
  );

  styles = maybeComputed(
    hasFn.has("styles"),
    () => resolveFieldProp(prop, UI_FORM_FN_STYLES, UI_FORM_STYLES, fs.value),
    getFieldMeta(prop, UI_FORM_STYLES),
  );

  options = maybeComputed(
    hasFn.has("options"),
    () => resolveOptions(prop, fs.value),
    resolveOptions(prop, emptyScope),
  );

  const hasFnAttr = hasFn.has("attr");
  attrs = hasFnAttr
    ? computed(() => resolveAttrs(prop, fs.value))
    : getFieldMeta(prop, UI_FORM_ATTR) !== undefined
      ? resolveAttrs(prop, emptyScope)
      : undefined;

  // ── Title (for structure/array/union fields) ───────────────
  title =
    isStructured || isUnion
      ? maybeComputed(
          hasFn.has("title"),
          () =>
            resolveFieldProp<string>(prop, UI_FORM_FN_TITLE, META_LABEL, fs.value) ??
            props.field.name,
          getFieldMeta(prop, META_LABEL) ?? props.field.name,
        )
      : undefined;

  // ── Classes — conditional computed ─────────────────────────
  const hasFnClasses = hasFn.has("classes");
  classesBase =
    hasFnClasses || typeof disabled !== "boolean"
      ? computed(() =>
          buildFieldClasses(
            hasFnClasses
              ? resolveFieldProp(prop, UI_FORM_FN_CLASSES, undefined, fs.value)
              : getFieldMeta(prop, UI_FORM_CLASSES),
            unwrap(disabled),
            hasMetaRequired,
            optional as boolean,
          ),
        )
      : buildFieldClasses(
          getFieldMeta(prop, UI_FORM_CLASSES),
          disabled as boolean,
          hasMetaRequired,
          optional as boolean,
        );

  // ── Phantom value (paragraph, action display) ──────────────
  phantomValue = props.field.phantom
    ? maybeComputed(
        hasFn.has("value"),
        () => resolveFieldProp(prop, UI_FORM_FN_VALUE, META_DEFAULT, fs.value),
        getFieldMeta(prop, META_DEFAULT),
      )
    : undefined;

  // ── Readonly watcher (computed derived fields) ─────────────
  if (hasFn.has("value") && !props.field.phantom) {
    const computedValue = computed(() => {
      if (unwrap(readonly)) return resolveFieldProp(prop, UI_FORM_FN_VALUE, META_DEFAULT, fs.value);
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
} = useAsField({
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

// Leaf-only per-keystroke external-error dismissal. Structured/union
// containers reach `dismissExternalAt` through `handleChange` instead.
if (!isStructured && !isUnion) {
  watch(model, (value, prev) => {
    if (value === prev) return;
    const path = absolutePath.value;
    if (path) dismissExternalAt(path);
  });
}

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
  prefixIcon,
  suffixIcon,
  level: isStructured || isUnion ? myLevel : undefined,
  // Resolved-once props: annotation reads + path/ids
  path: absolutePath.value,
  valueHelp,
  singularLabel,
  // Static literal precision (the storage cap — composables pad to this).
  precisionScale,
  // Whether AsField saw at least one adornment-driving annotation on this
  // field (currency / unit / prefix / suffix, literal or `.ref`). Used by
  // AsNumber / AsDecimal to pick the chrome path. Static — never changes.
  hasAdornment,
  inputId,
  errorId,
  descId,
};

// ── Display props — cached separately from error state ────────
// For allStatic fields this computed has zero reactive deps (evaluated
// once and cached). Error-only changes skip re-evaluating all unwrap() calls.
const displayProps = computed(() => {
  const titleValue = myLevel === 0 && hideRootTitle ? undefined : unwrap(title);
  return {
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
    title: titleValue,
    onRemove: props.onRemove,
    canRemove: props.canRemove,
    removeLabel: props.removeLabel,
    arrayIndex: props.arrayIndex,
    // Resolved measurement + adornment props (computed when present, else undef).
    currencyCode: unwrap(resolvedCurrencyCode),
    unitCode: unwrap(resolvedUnitCode),
    prefix: unwrap(resolvedPrefix),
    suffix: unwrap(resolvedSuffix),
    scale: unwrap(resolvedScale),
    ...unwrap(attrs),
  };
});

// ── Final component props — merges invariant + display + error state ──
// Grid classes live alongside the base class object: Vue's class binding
// flattens an array of {object, string} entries. The string is empty for
// default-footprint fields, which Vue safely skips.
const componentProps = computed(() => {
  const dp = displayProps.value;
  const err = mergedError.value;
  // `aria-describedby` resolves against the same id trio that defaults
  // wire onto their inputs — error/hint share `errorId`, description owns `descId`.
  const ariaDescribedBy = err || dp.hint ? errorId : dp.description ? descId : undefined;
  return {
    ...invariantProps,
    ...dp,
    error: err,
    ariaDescribedBy,
    class: [{ ...unwrap(classesBase), error: !!err }, gridClasses],
  };
});
</script>

<template>
  <component
    v-if="resolvedComponent"
    :is="resolvedComponent"
    v-bind="componentProps"
    @action="handleAction"
  />
  <div v-else>
    [{{ unwrap(label) }}] No component for type "{{ field.customType ?? field.type }}"{{
      componentName ? ` (component "${componentName}" not supplied)` : ""
    }}
  </div>
</template>
