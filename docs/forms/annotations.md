---
outline: deep
---

# Annotations Reference

This is the authoritative list of every annotation `@atscript/vue-form`
reads. Keep it open while you write `.as` types — most form questions
("how do I hide this field on weekends?", "how do I add a prefix `$`
to a price input?") resolve to "find the right annotation key".

Annotations come from three families:

- **`@meta.*`** and **`@expect.*`** — defined by atscript core. vue-form
  reads them; the language defines them. Full reference at
  [atscript.dev](https://atscript.dev).
- **`@ui.form.*`** — static UI configuration, defined by `@atscript/ui`.
- **`@ui.form.fn.*`** — dynamic JS-expression equivalents of the static
  keys. Require [`@atscript/ui-fns`](/forms/dynamic-fields) to evaluate.
- **`@ui.type`** — cross-cutting render-type override.
- **`@db.*`** — defined by `@atscript/db`. vue-form reads a few of them
  for measurement adornments and FK pickers. See
  [db.atscript.dev](https://db.atscript.dev).

Annotation key constants live in `packages/ui/src/plugin/*.ts` — every
table below pairs the `.as` syntax with the underlying string key so
you can grep the source.

## `@meta.*` — semantics

Defined by the atscript core (`@atscript/typescript`). These describe
**what the field means**, independent of how it's rendered.

| Annotation              | Arg    | Effect in vue-form                                                             |
| ----------------------- | ------ | ------------------------------------------------------------------------------ |
| `@meta.label 'X'`       | string | Field title / structured-section title; on the type itself it titles the form. |
| `@meta.description 'X'` | string | Help text rendered below the field label.                                      |
| `@meta.default 'X'`     | string | Default value applied by `createFormData` at form mount.                       |
| `@meta.required 'msg'`  | string | Marks the field required + supplies the validation error message.              |
| `@meta.readonly`        | flag   | Renders read-only; value can still be set programmatically.                    |
| `@meta.id`              | flag   | Marks the identity field (used by atscript-db and AsRef pickers).              |
| `@meta.sensitive`       | flag   | Hint to consumers that the value is sensitive (passwords, tokens).             |

Example:

```atscript
@meta.label 'Age'
@meta.required 'Age is required'
@meta.default '18'
age: number
```

See [atscript.dev — Annotations](https://atscript.dev) for the full
list of meta annotations the language ships with.

## `@expect.*` — validation

Defined by atscript core. `vue-form` runs them through the standard
atscript validator (`getFormValidator(def)`) — no extra wiring on the
Vue side.

| Annotation                      | Effect                            |
| ------------------------------- | --------------------------------- |
| `@expect.min N, 'msg'`          | numeric lower bound               |
| `@expect.max N, 'msg'`          | numeric upper bound               |
| `@expect.minLength N, 'msg'`    | string / array length lower bound |
| `@expect.maxLength N, 'msg'`    | string / array length upper bound |
| `@expect.pattern '/re/', 'msg'` | regex match                       |

On arrays, `@expect.minLength` and `@expect.maxLength` also drive the
`canAdd` / `canRemove` toggles on the rendered `AsArray` — see
[Arrays](/forms/arrays).

```atscript
@meta.label 'Username'
@meta.required 'Username is required'
@expect.minLength 3, 'Must be at least 3 characters'
@expect.maxLength 20, 'Must be at most 20 characters'
username: string
```

## `@ui.type` — built-in renderer override

The cross-surface render-type override. Flips which **built-in**
renderer a field uses on whichever surface lacks its own override
(`@ui.form.type` for forms, `@ui.table.type` for tables). The value
must be one of the built-in type ids that the form/cell type maps
know how to dispatch — `text`, `password`, `textarea`, `number`,
`decimal`, `select`, `radio`, `checkbox`, `multiselect`, `paragraph`,
`action`, `date`, `datetime`, `time`, etc.

For primitives it folds into the field's structural `type` at
FormDef-build time; for structured fields (`object`, `array`, `union`,
`tuple`) it lives in `customType` and is checked first in the lookup
(see `packages/vue-form/src/components/as-field.vue:373-386`).

```atscript
@ui.type 'password'
password: string

@ui.type 'select'
@ui.form.options 'admin' | 'user' | 'guest'
role: string

@ui.type 'textarea'
bio?: string
```

For **custom** renderers, use `@ui.form.component` (and
`@ui.table.component` on the table side) instead. Those routes look up
in the dedicated `:components` map — see
[Custom Components](/forms/custom-components) and
[Field Types](/forms/field-types).

## `@ui.form.*` — static UI config

The bulk of form customization lives here. Every key is **read once**
at field-setup time; values are inlined into the rendered component's
props. For values that depend on other field data, use the matching
`@ui.form.fn.*` key (next section).

### Display

| Annotation                      | Type   | Controls                                                                                                     |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `@ui.form.placeholder 'X'`      | string | input placeholder                                                                                            |
| `@ui.form.hint 'X'`             | string | inline hint below the input (overrides `meta.description` when both present and the field is in error state) |
| `@ui.form.label.singular 'tag'` | string | item-noun for arrays — drives "Add tag" / "Remove tag" buttons                                               |
| `@ui.form.submit.text 'X'`      | string | submit button text (on the type, not on a field)                                                             |

Field descriptions come from `@meta.description` — there is no
`@ui.form.description` static counterpart. For dynamic descriptions
use `@ui.form.fn.description` (see [Dynamic Fields](/forms/dynamic-fields)).

### Behaviour

| Annotation                      | Controls                                    |
| ------------------------------- | ------------------------------------------- |
| `@ui.form.hidden`               | hide field — phantom-renders, never visible |
| `@ui.form.disabled`             | disable input                               |
| `@ui.form.autocomplete 'email'` | sets HTML `autocomplete=` attribute         |

For read-only, use `@meta.readonly` — it is the single source of truth
that both forms and other surfaces read. For the dynamic counterpart
use `@ui.form.fn.readonly`.

### Layout

| Annotation                                                       | Controls                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| `@ui.form.order N`                                               | sort order within siblings                           |
| `@ui.form.grid.colSpan 'full' \| 'half' \| 'third' \| '1'..'12'` | grid column width (12-col grid)                      |
| `@ui.form.grid.rowSpan '1'..'4'`                                 | grid row span                                        |
| `@ui.form.classes 'a b'`                                         | extra classes on the field wrapper                   |
| `@ui.form.styles { ... }`                                        | inline style object                                  |
| `@ui.form.attr { ... }`                                          | extra HTML attributes forwarded to the input element |

See [Grid Layout](/forms/grid-layout) for the 12-column grid and the
`full`/`half`/`third` aliases.

### Adornments

Read together to drive the merged prefix / suffix chrome inside
numeric and decimal inputs. See `as-field.vue:199-307` for the full
resolution chain.

| Annotation                                | Effect                                              |
| ----------------------------------------- | --------------------------------------------------- |
| `@ui.form.prefix '$'`                     | literal prefix string                               |
| `@ui.form.prefix.ref 'currency'`          | resolve prefix from a sibling field's current value |
| `@ui.form.prefix.icon 'icon-credit-card'` | render an icon glyph as the prefix                  |
| `@ui.form.suffix '%'`                     | literal suffix string                               |
| `@ui.form.suffix.ref 'unit'`              | resolve suffix from a sibling field                 |
| `@ui.form.suffix.icon 'icon-percent'`     | suffix icon glyph                                   |

Currency and unit values are also pulled from `@db.amount.currency*`
and `@db.unit*` — see [DB annotations](#db-annotations-cross-cutting)
below.

### Actions

| Annotation                                             | Effect                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `@ui.type 'action'`                                    | renders the field as an action button (uses `AsAction`)                                 |
| `@ui.form.action { id, label }`                        | declares the action's id + label; `AsForm` emits `action` with the form data when fired |
| `@ui.form.pushDown`                                    | render this field in its own grid **below** the submit button instead of above it       |
| `@ui.form.attr 'text', '…'`                            | on an action field — text rendered before the link (e.g. "Already have an account?")    |
| `@ui.form.attr 'align', 'left' \| 'center' \| 'right'` | on an action field — alignment of the text + link row (default `left`)                  |
| `@ui.form.submit.text 'Save'`                          | on the type itself — submit button text                                                 |

See [Actions](/forms/actions) for the action lifecycle, below-submit placement,
and how `AsWfForm` extends this with workflow round-trips.

### Choice fields

| Annotation                                 | Effect                                        |
| ------------------------------------------ | --------------------------------------------- |
| `@ui.form.options 'a' \| 'b' \| 'c'`       | static option list for `select` / `radio`     |
| `@ui.form.options [{ value, label }]`      | richer static option list (objects)           |
| `@ui.form.fn.options '(v, data) => [...]'` | dynamic options (requires `@atscript/ui-fns`) |

`@ui.form.options` accepts either a string-literal-union shorthand or
an explicit array. Inline string unions (`'admin' | 'user'` directly
on the field type) are extracted automatically — no
`@ui.form.options` needed:

```atscript
role: 'admin' | 'user' | 'guest'
```

The same option sources also feed the `multiselect` renderer on array
fields — see [Field Types — Multi-select arrays](/forms/field-types#multi-select-arrays)
for the dispatch rules.

### Custom validation

| Annotation                                       | Effect                                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `@ui.form.validate '(v) => !!v \|\| "required"'` | custom validator expression (requires `@atscript/ui-fns`). Returns `true` on pass or a string error. |

The validator receives `(value, data, context)`. See
[Validation](/forms/validation).

### Component swap

| Annotation                     | Effect                                                                                                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ui.form.type 'textarea'`     | Flips to a different **built-in** renderer (`text`, `password`, `textarea`, `number`, `decimal`, `select`, `radio`, `checkbox`, `multiselect`, `date`, `datetime`, `time`, `paragraph`, `action`). Reserved for built-ins. |
| `@ui.form.component 'MyInput'` | Resolves a **named** component from the `:components` map (highest precedence). The dedicated mechanism for custom renderers.                                                                                              |

Resolution precedence (see `as-field.vue:373-386`):

```text
@ui.form.component  →  components[name]
@ui.form.type       →  types[customType]
field.type          →  types[type]
```

`@ui.form.type` is preferred for structured types where you want the
type-map (so the swap also applies to nested same-typed fields);
`@ui.form.component` is preferred when you have a one-off swap or
multiple shapes of the same structural type that need different
renderers. See [Custom Components](/forms/custom-components).

## `@ui.form.fn.*` — dynamic UI config

Identical key namespace to `@ui.form.*` but the value is a JS
function expression. The expression is parsed and evaluated through
`@atscript/ui-fns` against a per-field scope:

```ts
type TFnScope = {
  v: unknown; // current field value
  data: Record<string, unknown>; // entire form domain data
  context: Record<string, unknown>; // form-level context
  entry: { type; component; name; optional; disabled; hidden; readonly };
};
```

Field-level (declared on a prop):

| Annotation                | Computes                                                                          |
| ------------------------- | --------------------------------------------------------------------------------- |
| `@ui.form.fn.label`       | label string                                                                      |
| `@ui.form.fn.description` | description string                                                                |
| `@ui.form.fn.hint`        | hint string                                                                       |
| `@ui.form.fn.placeholder` | placeholder string                                                                |
| `@ui.form.fn.hidden`      | boolean                                                                           |
| `@ui.form.fn.disabled`    | boolean                                                                           |
| `@ui.form.fn.readonly`    | boolean                                                                           |
| `@ui.form.fn.classes`     | class object / string                                                             |
| `@ui.form.fn.styles`      | style object                                                                      |
| `@ui.form.fn.attr`        | HTML attribute map                                                                |
| `@ui.form.fn.options`     | dynamic option list                                                               |
| `@ui.form.fn.value`       | derived value (readonly fields are auto-synced; phantom paragraph/action display) |

Top-level (declared on the root `interface` / `type`, receives `(data, context)`):

| Annotation                    | Computes                        |
| ----------------------------- | ------------------------------- |
| `@ui.form.fn.title`           | dynamic form title              |
| `@ui.form.fn.description`     | dynamic form description        |
| `@ui.form.fn.submit.text`     | dynamic submit button text      |
| `@ui.form.fn.submit.disabled` | dynamic submit-disabled boolean |

Example — hide a "Room" field when no Floor has been picked:

```atscript
@meta.label 'Room'
@ui.form.fn.hidden '(v, data) => !data.contact?.department?.floor'
room?: string
```

Full coverage in [Dynamic Fields](/forms/dynamic-fields).

::: warning Trade-offs
Every `@ui.form.fn.*` key on a field promotes it from the static
fast-path to the dynamic path (`as-field.vue:409` vs `:446`). The
dynamic path builds a reactive `TFnScope` per evaluation, so reach
for `fn.*` when the value depends on other form state and stick with
the static keys when it doesn't.
:::

## DB annotations (cross-cutting)

vue-form reads these even though they're defined by `@atscript/db`.
Use them on `.as` types that are shared between the form and the
database layer — you write the metadata once and both surfaces pick it
up. Full coverage at [db.atscript.dev](https://db.atscript.dev).

### Currency & units

| Annotation                                  | Effect on form                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `@db.amount.currency 'USD'`                 | hard-code the currency — drives `AsDecimal`'s prefix glyph + `Intl.NumberFormat` decimals |
| `@db.amount.currency.ref 'cur'`             | resolve currency from a sibling field at runtime                                          |
| `@db.unit 'kg'`                             | hard-code a measurement unit — drives suffix                                              |
| `@db.unit.ref 'unit'`                       | resolve unit from a sibling                                                               |
| `@db.column.precision { precision, scale }` | numeric precision/scale; `scale` caps the displayed decimals                              |

### Foreign keys (AsRef value-help)

| Annotation                       | Effect                                     |
| -------------------------------- | ------------------------------------------ |
| `@db.rel.FK 'OtherTable'`        | declares a foreign-key relation            |
| `@db.http.path '/api/customers'` | URL the `AsRef` picker queries for options |

When both are present the field renders an `AsRef` picker by default
(searchable, paged, server-driven). See [References](/forms/references).

## Cross-cutting reads

A few patterns you'll see again and again:

- **Optional + required** — `firstName?: string` with `@meta.required`
  means "if you provide it, you must provide a value". In practice
  vue-form treats this as not-required for the field marker (the `*`
  would mislead) — see `as-field.vue:167-181`.
- **Phantom fields** — fields with no input element (paragraphs,
  actions) read `@meta.default` (or `@ui.form.fn.value` dynamically) as
  the displayed value.
- **Order resolution** — `@ui.form.order` is numeric; ties fall through
  in declaration order. Mixing some-ordered + some-unordered fields
  works.

## Next steps

- [Field Types](/forms/field-types) — what each `@ui.type` value
  resolves to.
- [Validation](/forms/validation) — `@expect.*`, `@ui.form.validate`,
  external errors.
- [Dynamic Fields](/forms/dynamic-fields) — full coverage of
  `@ui.form.fn.*`.
- [References](/forms/references) — `@db.rel.FK` and value-help pickers.
