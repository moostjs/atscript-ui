# Dynamic Fields

Static `@ui.form.*` annotations describe a frozen form. Real apps need fields
that react to other fields — hide a "plus-one name" until the "bringing a
plus-one" checkbox is set, recompute a select's options from a sibling country
code, swap a submit button's label based on the current draft.

`@atscript/ui-fns` adds a parallel `@ui.form.fn.*` family of annotations. Each
takes a function body as a string. The body is compiled once with `new Function`
and re-evaluated whenever form data changes.

## Install the resolver

`@atscript/ui` ships a static resolver that ignores every `*.fn.*` key. Install
the dynamic resolver once at app startup — both client and server entries when
SSR is involved.

```typescript
// entry-client.ts / entry-server.ts
import { installDynamicResolver } from "@atscript/ui-fns";

installDynamicResolver();
```

`installDynamicResolver()` swaps in `DynamicFieldResolver` and registers the
ui-fns validator plugin so `@ui.form.validate '(v, data) => ...'` strings also
compile.

## Scope passed to every function

Every compiled function body sees these variables in scope:

| Variable  | What it is                                                                 |
| --------- | -------------------------------------------------------------------------- |
| `v`       | Current value of the annotated field                                       |
| `data`    | Unwrapped domain data (`formData.value`)                                   |
| `context` | The `:form-context` prop passed to `<AsForm>`, or `{}`                     |
| `entry`   | Per-field evaluated snapshot (name, type, disabled, options, …)            |
| `action`  | Dispatched action id when the evaluation was kicked off by an action click |

The full type is `TFnScope` from `@atscript/ui-fns/runtime/types.ts`.

```typescript
interface TFnScope<V = unknown> {
  v?: V;
  data: Record<string, unknown>;
  context: Record<string, unknown>;
  entry?: TFieldEvaluated;
  action?: string;
}
```

Top-level functions (`@ui.form.fn.title`, `@ui.form.fn.submit.text`,
`@ui.form.fn.submit.disabled`) receive only `(data, context)` — there
is no `v`, `entry`, or `action` at the form-level scope.

## Every static prop has a dynamic counterpart

Field-level keys:

| Static                 | Dynamic                   |
| ---------------------- | ------------------------- |
| `@meta.label`          | `@ui.form.fn.label`       |
| `@meta.description`    | `@ui.form.fn.description` |
| `@ui.form.placeholder` | `@ui.form.fn.placeholder` |
| `@ui.form.hint`        | `@ui.form.fn.hint`        |
| `@ui.form.hidden`      | `@ui.form.fn.hidden`      |
| `@ui.form.disabled`    | `@ui.form.fn.disabled`    |
| `@meta.readonly`       | `@ui.form.fn.readonly`    |
| `@ui.form.options`     | `@ui.form.fn.options`     |
| `@meta.default`        | `@ui.form.fn.value`       |
| `@ui.form.attr`        | `@ui.form.fn.attr`        |
| `@ui.form.classes`     | `@ui.form.fn.classes`     |
| `@ui.form.styles`      | `@ui.form.fn.styles`      |

Form-level keys (on the root `interface`):

| Static                 | Dynamic                       |
| ---------------------- | ----------------------------- |
| `@meta.label`          | `@ui.form.fn.title`           |
| `@ui.form.submit.text` | `@ui.form.fn.submit.text`     |
| —                      | `@ui.form.fn.submit.disabled` |

When both static and dynamic are present, the dynamic one wins.

## Worked example

A `DynamicForm.as` schema that exercises every dynamic key on one form:

```atscript
@meta.label 'Event Registration'

@ui.form.fn.title '(data) => data.firstName ? "Registration for " + data.firstName : "Event Registration"'
@ui.form.fn.submit.text '(data) => data.hasPlusOne ? "Register 2 attendees" : "Register"'
@ui.form.fn.submit.disabled '(data) => !data.firstName || !data.email'
export interface EventRegistration {
    @meta.label 'First Name'
    @ui.form.grid.colSpan '6'
    firstName: string

    @meta.label 'Email'
    @ui.form.grid.colSpan '6'
    @ui.form.fn.placeholder '(v, data) => data.firstName ? "Email for " + data.firstName : "you@example.com"'
    email: string

    @meta.label 'Bringing a plus-one?'
    hasPlusOne: boolean

    @meta.label "Plus-one's name"
    @ui.form.fn.hidden '(v, data) => !data.hasPlusOne'
    plusOneName: string

    @meta.label 'T-shirt size'
    @ui.form.fn.options '(v, data) => data.hasPlusOne ? [{ key: "S", label: "Small" }, { key: "M", label: "Medium" }, { key: "L", label: "Large" }, { key: "XS-PLUS", label: "Plus-One Small" }] : [{ key: "S", label: "Small" }, { key: "M", label: "Medium" }, { key: "L", label: "Large" }]'
    shirtSize: ui.select

    @meta.label 'Notes'
    @ui.form.fn.hint '(v, data) => (v ? v.length : 0) + " / 500 chars"'
    @ui.form.fn.classes '(v, data) => (v && v.length > 400) ? "as-notes-warn" : ""'
    @ui.form.validate '(v, data) => !v || v.length <= 500 || "Notes must be 500 chars or fewer"'
    notes: string

    @meta.label 'Total attendees'
    @ui.form.fn.value '(v, data) => data.hasPlusOne ? 2 : 1'
    attendees: ui.paragraph
}
```

The matching Vue page is a normal `<AsForm>`:

```vue
<script setup lang="ts">
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import { EventRegistration } from "./schemas/EventRegistration.as";

const { def, formData } = createAsFormDef(EventRegistration);
const types = createDefaultTypes();
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" />
</template>
```

No imperative wiring. Every dependent prop re-evaluates whenever `formData`
mutates, because each `@ui.form.fn.*` resolver reads through the same reactive
`data` getter exposed to `<AsField>`.

## Common patterns

### Hide a field unless a sibling is set

```atscript
@meta.label "Plus-one's name"
@ui.form.fn.hidden '(v, data) => !data.hasPlusOne'
plusOneName: string
```

### Dynamic options list

```atscript
@meta.label 'City'
@ui.form.fn.options '(v, data) => citiesByCountry[data.country] ?? []'
city: ui.select
```

`citiesByCountry` must be in scope. Functions only see `v`, `data`, `context`,
`entry`. To inject an external lookup table, pass it through the `:form-context`
prop on `<AsForm>` and read `context.citiesByCountry` instead.

```vue
<AsForm :def="def" :form-data="formData" :form-context="{ citiesByCountry }" :types="types" />
```

```atscript
@ui.form.fn.options '(v, data, ctx) => ctx.citiesByCountry[data.country] ?? []'
city: ui.select
```

### Computed label from form context

```atscript
@meta.label 'Welcome'
@ui.form.fn.title '(_v, _data, ctx) => "Welcome " + ctx.userName'
export interface WelcomeForm { ... }
```

### Disable submit until required fields are set

```atscript
@ui.form.fn.submit.disabled '(data) => !data.firstName || !data.email'
export interface RegistrationForm { ... }
```

The form-level scope reuses the same compiler — `data` is the first argument.

### Read-only depending on a sibling

```atscript
@meta.label 'Dietary preferences'
@ui.form.fn.readonly '(v, data) => !data.email'
@ui.form.fn.hint '(v, data) => !data.email ? "Enter your email first to enable this" : "Comma-separated"'
dietary: string
```

### Custom validator string

`@ui.form.validate` lives outside the `fn.*` namespace but uses the same
compiler. Return `true` for pass, a string message for fail.

```atscript
@ui.form.validate '(v, data) => !v || v.length <= 500 || "Notes must be 500 chars or fewer"'
notes: string
```

The validator runs alongside `@expect.*` rules and reports through the same
error pipeline. See [Validation](/forms/validation).

## Performance

Compiled functions are cached by `@prostojs/deserialize-fn`'s `FNPool`, keyed on
the function-body string. Two annotations with identical bodies share a single
compiled function instance.

The resolver is invoked per field per data change; bodies should stay cheap.
Pull lookup tables through `context` instead of allocating new arrays inside the
function body when possible.

## Security

`new Function` is real `eval`. The function strings ship in your `.as` files,
which are compile-time artifacts you own — that's safe. Two things to never do:

::: warning

- **Don't store user-authored expressions** in a database and feed them to
  `ui-fns`. Anyone with write access to that store gets arbitrary code
  execution in the browser.
- **Don't disable `installDynamicResolver()` in production while keeping
  `@ui.form.fn.*` in your `.as`** — the static resolver silently ignores
  `*.fn.*` keys and your forms will appear broken with no error.
  :::

## Next steps

- [Validation](/forms/validation) for `@ui.form.validate` and `@expect.*` rules
- [Grid layout](/forms/grid-layout) for the `@ui.form.grid.*` annotations used above
- [Actions](/forms/actions) for action buttons and dynamic submit text
