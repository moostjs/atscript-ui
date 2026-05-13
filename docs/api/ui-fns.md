# @atscript/ui-fns

Opt-in dynamic resolver that wires `@ui.form.fn.*`, `@ui.table.fn.*`, and `@ui.form.validate` annotation strings into the global resolver in [`@atscript/ui`](/api/ui). Without this package every `@ui.fn.*` annotation is silently ignored.

## Contents

- [Plugin](#plugin)
- [Installer](#installer)
- [Dynamic resolver](#dynamic-resolver)
- [Compilers](#compilers)
- [Validator plugin](#validator-plugin)
- [Helpers](#helpers)
- [Types](#types)
- [Security](#security)
- [Performance](#performance)

## Plugin

`@atscript/ui-fns/plugin` registers the build-time `@ui.fn.*` annotation keys (form + table) and `@ui.form.validate`. Add it next to `uiPlugin()` in `atscript.config.ts`:

```typescript
import uiPlugin from "@atscript/ui/plugin";
import uiFnsPlugin from "@atscript/ui-fns/plugin";

export default {
  plugins: [uiPlugin(), uiFnsPlugin()],
};
```

## Installer

### `installDynamicResolver()`

One-shot installer. Calls `setResolver(new DynamicFieldResolver())` and `setDefaultValidatorPlugins([uiFnsValidatorPlugin()])`. Invoke once at app startup, before any form/table is built.

```typescript
import { installDynamicResolver } from "@atscript/ui-fns";

installDynamicResolver();
```

After this, every `resolveFieldProp`/`resolveFormProp` call walks the `ui.fn.*` keys first and compiles them on demand. Static annotations still work exactly as in `@atscript/ui`.

## Dynamic resolver

### `DynamicFieldResolver`

Class implementing [`FieldResolver`](/api/ui#field-resolver). Compiles and evaluates `@ui.form.fn.*` / `@ui.table.fn.*` annotation strings on demand, falling back to static resolution via `resolveStatic`.

```typescript
class DynamicFieldResolver implements FieldResolver {
  resolveFieldProp<T>(prop, fnKey, staticKey, scope, opts?): T | undefined;
  resolveFormProp<T>(type, fnKey, staticKey, scope, opts?): T | undefined;
  hasComputedAnnotations(prop: TAtscriptAnnotatedType): boolean;
}
```

`hasComputedAnnotations` returns true when at least one metadata key on the prop starts with `ui.form.fn.` or `ui.table.fn.` — the Vue form/table layers use this as a perf flag to skip per-keystroke re-resolution for fully static fields.

### Attr handling

Keys ending in `attr` (`UI_FORM_FN_ATTR`, `UI_TABLE_FN_ATTR`) store `[{ name, fn }]` arrays instead of a single fn string; the resolver evaluates each entry and merges into a single record.

## Compilers

All three functions return a callable bound to a [`TFnScope`](#types). Compiled functions are cached in an internal `FNPool` keyed by the source string.

### `compileFieldFn(fnStr)`

```typescript
function compileFieldFn<R = unknown>(fnStr: string): (scope: TFnScope) => R;
```

The string is wrapped as:

```javascript
return (<fnStr>)(v, data, context, entry)
```

So a field-level dynamic annotation reads like:

```atscript
@ui.form.fn.hidden '(v, data) => !data.optedIn'
```

### `compileTopFn(fnStr)`

```typescript
function compileTopFn<R = unknown>(fnStr: string): (scope: TFnScope) => R;
```

Form-level wrapping — no leaf value or entry:

```javascript
return (<fnStr>)(data, context)
```

Used for `@ui.form.fn.title`, `@ui.form.fn.submitText`, `@ui.form.fn.submitDisabled`.

### `compileValidatorFn(fnStr)`

Delegates to `compileFieldFn` with a narrowed return type. Returns `true` for valid, or a string error message for invalid.

```typescript
function compileValidatorFn(fnStr: string): (scope: TFnScope) => boolean | string;
```

## Validator plugin

### `uiFnsValidatorPlugin()`

Returns a [`TValidatorPlugin`](/api/ui#validators) that walks `@ui.form.validate` annotations on a field, compiles each, and reports the first non-`true` result as the field's validation error.

```typescript
function uiFnsValidatorPlugin(): TValidatorPlugin;
```

The plugin is auto-registered by `installDynamicResolver()`. Re-export and add it manually if you need a fine-grained Validator instance.

```atscript
@ui.form.validate '(v, data) => v === data.passwordConfirm || "Passwords do not match"'
password: string
```

See [Validation](/forms/validation) for end-to-end usage.

## Helpers

### `buildFieldEntry(prop, baseScope, path, opts?)`

Implements the dual-scope pattern used by the resolver and the validator plugin:

1. Resolve constraints (`disabled`, `hidden`, `readonly`) from `baseScope`.
2. Assemble a `TFieldEvaluated` entry object.
3. Build the full scope `{ ...baseScope, entry }`.
4. Resolve `options` against the full scope (so option expressions can read the entry's `type` / `disabled`).

```typescript
function buildFieldEntry(
  prop: TAtscriptAnnotatedType,
  baseScope: TFnScope,
  path: string,
  opts?: TBuildFieldEntryOpts,
): TFnScope;

type TBuildFieldEntryOpts = Partial<
  Pick<
    TFieldEvaluated,
    "name" | "type" | "component" | "optional" | "disabled" | "hidden" | "readonly"
  >
>;
```

The returned scope is the full evaluation scope (with `entry` populated). Use it when invoking other compiled fns that depend on resolved field state.

## Types

### `TFnScope`

The eval scope passed to every compiled function. Properties become positional arguments inside the wrapping shim:

```typescript
interface TFnScope<V = unknown, D = Record<string, unknown>, C = Record<string, unknown>> {
  /** Current field value (leaf). Undefined for form-level fns. */
  v?: V;
  /** Whole form's domain data. */
  data: D;
  /** Caller-supplied formContext. */
  context: C;
  /** Resolved field meta (label, type, disabled, hidden, options, …). */
  entry?: TFieldEvaluated;
  /** Action name when the fn is evaluated during action dispatch. */
  action?: string;
}
```

### `TComputed<T>`

Convenience union for "static value or scope-bound function".

```typescript
type TComputed<T> = T | ((scope: TFnScope) => T);
```

### `TFieldEvaluated`

Resolved per-field snapshot passed to validators and computed annotations as `entry`.

```typescript
interface TFieldEvaluated {
  field: string;
  type: string;
  component?: string;
  name: string;
  disabled?: boolean;
  optional?: boolean;
  hidden?: boolean;
  readonly?: boolean;
  options?: TFormEntryOptions[];
}
```

### `TValidatorContext`

Per-call context passed via `validator.validate(value, safe, context)` and unpacked by `uiFnsValidatorPlugin`.

```typescript
interface TValidatorContext {
  data: Record<string, unknown>;
  context: Record<string, unknown>;
}
```

### `TBuildFieldEntryOpts`

Defined above next to [`buildFieldEntry`](#helpers).

## Security

`compileFieldFn`, `compileTopFn`, and `compileValidatorFn` all use `new Function` under the hood (via `@prostojs/deserialize-fn`'s `FNPool`). The compiled function runs in the host JS realm — it sees `globalThis`, can throw, can loop forever.

This is **only safe for compile-time-validated schemas you author or trust**. Never accept user-authored fn strings from the network and feed them through this resolver. The atscript compiler validates expression syntax at build time so a typo fails CI rather than at runtime.

Browser deployments with strict CSP require `unsafe-eval`.

## Performance

- Every fn string is compiled once and cached in `FNPool` for the lifetime of the process. Identical strings on different fields share the same compiled function.
- `hasComputedAnnotations` short-circuits Vue's per-keystroke re-resolution: fields where every annotation is static skip the resolver loop entirely. The `FormFieldDef.allStatic` flag mirrors this on the form side.
- `buildFieldEntry` resolves constraints once, then reuses the entry across `options` and validator evaluation in the same submit pass.

## Cross-links

- [Forms — Dynamic Fields](/forms/dynamic-fields)
- [Forms — Validation](/forms/validation)
- [@atscript/ui — FieldResolver](/api/ui#field-resolver)
- [@atscript/ui — Validators](/api/ui#validators)
