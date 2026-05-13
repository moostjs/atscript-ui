# dynamic-fields

`@atscript/ui-fns` — opt-in plugin that compiles `@ui.form.fn.*` annotation strings into runtime functions. Required for any dynamic behaviour: conditional hidden / disabled / options, computed labels, custom validators, dynamic submit button text.

## Contents

- [installDynamicResolver()](#installdynamicresolver)
- [TFnScope](#tfnscope)
- [@ui.form.fn.\* exhaustive table](#uiformfn-exhaustive-table)
- [Recipes](#recipes)
- [Function-string syntax](#function-string-syntax)
- [Security model](#security-model)
- [allStatic optimization](#allstatic-optimization)

## installDynamicResolver()

Call once at app startup, before mounting any `<AsForm>`:

```typescript
// main.ts
import { installDynamicResolver } from "@atscript/ui-fns";

installDynamicResolver();
```

Internally:

```typescript
// packages/ui-fns/src/index.ts:32-35
export function installDynamicResolver(): void {
  setResolver(new DynamicFieldResolver());
  setDefaultValidatorPlugins([uiFnsValidatorPlugin()]);
}
```

Without this:

- `@ui.form.fn.*` annotations silently evaluate to `undefined` (the static resolver ignores `.fn.` keys).
- `@ui.form.validate` does nothing — the validator plugin isn't registered.

Proof of life — add a hidden-when-empty test to any `.as` file and verify it works after install:

```atscript
@meta.label 'Hide me'
@ui.form.fn.hidden '(_, data) => !data.name'
hint?: string

@meta.label 'Name'
name: string
```

Type something in `name`; `hint` appears. Without `installDynamicResolver()`, `hint` is always visible.

## TFnScope

Every compiled function receives the scope object — its keys become the variables `v`, `data`, `context`, `entry`, `action` inside the function body.

```typescript
// packages/ui-fns/src/runtime/types.ts:8-14
export interface TFnScope<V = unknown, D = Record<string, unknown>, C = Record<string, unknown>> {
  v?: V; // current field value (this field)
  data: D; // form data, unwrapped (the inner domain object)
  context: C; // form-wide context (from <AsForm :form-context> / useAsForm({ context }))
  entry?: TFieldEvaluated; // minimal snapshot of THIS field's evaluated state
  action?: string; // present only when invoked from an action handler
}
```

`TFieldEvaluated`:

```typescript
// packages/ui-fns/src/runtime/types.ts:25-35
export interface TFieldEvaluated {
  field: string; // dotted path
  type: string; // resolved field type ('text', 'select', ...)
  component?: string; // @ui.form.component value
  name: string; // last path segment
  disabled?: boolean;
  optional?: boolean;
  hidden?: boolean;
  readonly?: boolean;
  options?: TFormEntryOptions[];
}
```

`data` is the unwrapped domain data — already de-referenced from the `{ value: ... }` container. `context` is whatever you passed to `<AsForm :form-context>`.

Form-level functions (e.g. `@ui.form.fn.submit.text`) compile via `compileTopFn`:

```typescript
// packages/ui-fns/src/runtime/fn-compiler.ts:30-33
const code = `return (${fnStr})(data, context)`;
```

So form-level fns receive `(data, context)` and field-level fns receive `(v, data, context, entry)`.

## `@ui.form.fn.*` exhaustive table

| Annotation                    | Signature                                                        | Replaces / defaults from | Purpose                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `@ui.form.fn.label`           | `(v, data, context, entry) => string`                            | `@meta.label`            | Computed field label.                                                                                                           |
| `@ui.form.fn.placeholder`     | `(v, data, context, entry) => string`                            | `@ui.form.placeholder`   | Computed placeholder.                                                                                                           |
| `@ui.form.fn.description`     | `(v, data, context, entry) => string`                            | `@meta.description`      | Computed inline description.                                                                                                    |
| `@ui.form.fn.hint`            | `(v, data, context, entry) => string`                            | `@ui.form.hint`          | Computed hint (renders under description).                                                                                      |
| `@ui.form.fn.hidden`          | `(v, data, context, entry) => boolean`                           | `@ui.form.hidden`        | Hide the field. Hidden fields still validate.                                                                                   |
| `@ui.form.fn.disabled`        | `(v, data, context, entry) => boolean`                           | `@ui.form.disabled`      | Disable input.                                                                                                                  |
| `@ui.form.fn.readonly`        | `(v, data, context, entry) => boolean`                           | `@meta.readonly`         | Read-only mode. When `readonly === true` AND `@ui.form.fn.value` is set, AsField writes the computed value back into the model. |
| `@ui.form.fn.options`         | `(v, data, context, entry) => TFormEntryOptions[]`               | `@ui.form.options`       | Computed select/radio options.                                                                                                  |
| `@ui.form.fn.value`           | `(v, data, context, entry) => unknown`                           | `@meta.default`          | For phantom paragraphs/actions — display value. For data fields — also writes back when readonly.                               |
| `@ui.form.fn.attr`            | array `[{ name, fn }]`                                           | `@ui.form.attr`          | Computed attribute key-values forwarded to the input element.                                                                   |
| `@ui.form.fn.classes`         | `(v, data, context, entry) => string \| Record<string, boolean>` | `@ui.form.classes`       | Computed extra CSS classes on the field wrapper.                                                                                |
| `@ui.form.fn.styles`          | `(v, data, context, entry) => Record<string, string>`            | `@ui.form.styles`        | Computed inline styles on the field wrapper.                                                                                    |
| `@ui.form.fn.title`           | `(v, data, context, entry) => string`                            | `@meta.label`            | For structured fields (object/array/union) — computed title in the collapsible header.                                          |
| `@ui.form.fn.submit.text`     | `(data, context) => string`                                      | `@ui.form.submit.text`   | Form-level: computed submit-button text.                                                                                        |
| `@ui.form.fn.submit.disabled` | `(data, context) => boolean`                                     | n/a                      | Form-level: computed submit-button disabled state.                                                                              |
| `@ui.form.validate`           | `(v, data, context, entry) => true \| string`                    | n/a                      | Custom validator. Returns `true` for valid; any string is the error message.                                                    |

Sources: `packages/ui/src/shared/annotation-keys.ts`, `packages/vue-form/src/components/as-field.vue:449-631`.

The static counterpart (e.g. `@ui.form.label`) is read when the `.fn.` variant is absent. When both are present, the `.fn.` value wins.

## Recipes

All examples assume `installDynamicResolver()` has been called.

### Hide a field unless a sibling is set

```atscript
country: string

@ui.form.fn.hidden '(_, data) => !data.country'
state?: string
```

### Compute a label from a sibling

```atscript
country: string

@ui.form.fn.label '(_, data) => "Phone for " + (data.country || "unknown")'
phone: string
```

### Options list driven by data

```atscript
@expect.values ['US', 'CA', 'UK']
country: string

@ui.form.fn.options '(_, data) => {
  const map = { US: ["NY","CA"], CA: ["ON","QC"], UK: ["LDN","SCT"] };
  return (map[data.country] || []).map(v => ({ value: v, label: v }));
}'
@ui.form.fn.disabled '(_, data) => !data.country'
region?: string
```

### Custom validator

```atscript
@ui.form.validate '(v) => v.length > 500 ? "Too long, keep it under 500 chars" : true'
message?: string
```

Cross-field validator — read another field via `data`:

```atscript
password: string

@ui.form.validate '(v, data) => v === data.password ? true : "Passwords do not match"'
passwordConfirm: string
```

### Conditional submit text + disabled

```atscript
@ui.form.fn.submit.text '(data) => data.id ? "Update" : "Create"'
@ui.form.fn.submit.disabled '(data) => !data.email'
export interface User {
    id?: number
    email: string
    name: string
}
```

### Phantom paragraph displaying computed text

```atscript
@meta.label 'Summary'
@ui.form.type 'paragraph'
@ui.form.fn.value '(_, data) =>
  data.items.length + " items, total " + data.items.reduce((s,i)=>s+i.price,0).toFixed(2)
'
summary?: string
```

The field never enters the data — `paragraph` is a phantom renderer. `_` is `v` (always `undefined` for phantoms).

### Readonly field that auto-fills

```atscript
quantity: number
unitPrice: number

@meta.readonly
@ui.form.fn.value '(_, data) => data.quantity * data.unitPrice'
total: number
```

`readonly === true` AND `@ui.form.fn.value` set → AsField writes the computed value into `data.total` whenever inputs change. (See `as-field.vue:615-631`.)

## Function-string syntax

`compileFieldFn` wraps the string in:

```typescript
return (${fnStr})(v, data, context, entry)
```

So the string is treated as a single expression that produces a function. Accepted forms:

```typescript
// Arrow expression
"(v, data) => !data.foo";

// Arrow with block body
"(v, data) => { const out = !data.foo; return out; }";

// Comma-operator (early-return style without a block)
'(v) => (v == null ? "Required" : true)';

// Function expression
'function(v, data) { return v > data.limit ? "Too high" : true }';
```

Compilation is **lazy** (first read) and **cached** by string body via `FNPool` from `@prostojs/deserialize-fn`. Two fields whose annotations share an identical string share one compiled function — no extra `new Function` cost.

Source: `packages/ui-fns/src/runtime/fn-compiler.ts:16-19`.

## Security model

`new Function` runs in the host's full scope — these functions can call any globals available at runtime (`fetch`, `localStorage`, `window`, ...). The design assumes:

- `.as` files are **compile-time-validated, trusted source** under your repository.
- Annotation strings are **author-controlled, not user-controlled**.

Never store user-authored annotation strings and feed them into `installDynamicResolver()`. If you must accept user-authored validation, write a regular submit handler in your component instead.

The compiler does NOT sandbox. There is no allow-list of identifiers.

## allStatic optimization

`FormFieldDef.allStatic === true` when the field's prop carries NO `@ui.form.fn.*` / `@ui.table.fn.*` / `@ui.fn.*` annotations. AsField's hot path checks this:

```typescript
// packages/vue-form/src/components/as-field.vue:409-445
if (props.field.allStatic) {
  // Fast path: no fn keys → no scope, no computeds.
  hasCustomValidators = false;
  disabled = getFieldMeta(prop, UI_FORM_DISABLED) !== undefined;
  // ... read every prop once, return raw values (not ComputedRefs)
}
```

- Without dynamic fns, all field props are plain values (no reactive subscriptions, no scope construction).
- The `emptyScope` is a module-level singleton shared across every `allStatic` AsField mount (`as-field.vue:4-10`).

When at least one `@ui.fn.*` is present, AsField takes the dynamic path:

- Computes the field-level scope lazily (`baseScope` for boolean constraints, `fullScope` adds `entry`).
- Wraps every annotation read in a `computed()` that subscribes to the scope changes.

Cost model: a form with N fields where none use dynamic fns has zero reactive overhead beyond the model bindings. Adding one dynamic field costs one scope + one computed per dynamic annotation on that field. Static fields in the same form stay on the fast path.
