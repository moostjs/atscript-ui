Authoritative reference for every `@ui.*` and `@wf.*` annotation. Spec source: `packages/ui/src/plugin/annotations.ts`, `packages/ui/src/shared/annotation-keys.ts`, `packages/ui-fns/src/plugin/annotations.ts`, `packages/moost-wf/src/plugin.ts`.

## Contents

- [Cross-surface: @ui.type](#cross-surface-uitype)
- [@ui.form.\* (static)](#uiform-static)
- [@ui.form.grid.\*](#uiformgrid)
- [@ui.form.prefix._ / @ui.form.suffix._](#uiformprefix--uiformsuffix)
- [@ui.form.fn.\* (dynamic — requires @atscript/ui-fns)](#uiformfn-dynamic--requires-atscriptui-fns)
- [@ui.form.validate (dynamic)](#uiformvalidate-dynamic)
- [@ui.table.\* (static)](#uitable-static)
- [@ui.table.fn.\* (dynamic)](#uitablefn-dynamic)
- [@ui.dict.\* (value-help target)](#uidict-value-help-target)
- [@ui.array.\* (array control)](#uiarray-array-control)
- [@wf.\* (workflow side)](#wf-workflow-side)
- [@meta._ and @expect._ that vue-form/vue-table consume](#meta-and-expect-that-vue-formvue-table-consume)
- [@db.\* that vue-form/vue-table consume](#db-that-vue-formvue-table-consume)
- [Resolution precedence](#resolution-precedence)

## Cross-surface: @ui.type

`@ui.type "name"` — cell + input renderer type override, applied to whichever surface (form input OR table cell) lacks its own override. `@ui.form.type` / `@ui.table.type` wins per-surface.

| Constant  | Key       | Argument       | nodeType       |
| --------- | --------- | -------------- | -------------- |
| `UI_TYPE` | `ui.type` | `type: string` | `prop`, `type` |

**Built-in renderer ids** (`packages/ui/src/plugin/annotations.ts:4-18`):

`text`, `password`, `number`, `decimal`, `select`, `textarea`, `checkbox`, `radio`, `date`, `datetime`, `time`, `paragraph`, `action`.

**Custom renderers use `@ui.form.component` / `@ui.table.component`, not `@ui.type`.** `@ui.type` is for the built-in id set; the type argument is "intentionally open-ended" only so consumer-defined renderer maps can extend the list.

```atscript
@ui.type "decimal"
amount: number
```

## @ui.form.\* (static)

All `nodeType: ["prop", "type"]` unless noted. Static = no fn compilation — values are read directly off `prop.metadata`.

| Annotation                           | Constant                 | Arguments                       | What it controls                                                                                                                                  |
| ------------------------------------ | ------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ui.form.placeholder "text"`        | `UI_FORM_PLACEHOLDER`    | `text: string`                  | HTML placeholder.                                                                                                                                 |
| `@ui.form.hint "text"`               | `UI_FORM_HINT`           | `text: string`                  | Help text / tooltip rendered near the field.                                                                                                      |
| `@ui.form.classes "names"`           | `UI_FORM_CLASSES`        | `names: string`                 | CSS classes on the rendered field; **multiple, appended**. `nodeType` also `interface`.                                                           |
| `@ui.form.styles "css"`              | `UI_FORM_STYLES`         | `css: string`                   | Inline styles; **multiple, appended**. `nodeType` also `interface`.                                                                               |
| `@ui.form.autocomplete "value"`      | `UI_FORM_AUTOCOMPLETE`   | `value: string`                 | HTML `autocomplete` attribute.                                                                                                                    |
| `@ui.form.disabled`                  | `UI_FORM_DISABLED`       | (none)                          | Statically disabled.                                                                                                                              |
| `@ui.form.hidden`                    | `UI_FORM_HIDDEN`         | (none)                          | Statically hidden.                                                                                                                                |
| `@ui.form.options "label", "value"?` | `UI_FORM_OPTIONS`        | `label: string, value?: string` | Static select/radio option; **multiple, replace**. Value defaults to label.                                                                       |
| `@ui.form.order n`                   | `UI_FORM_ORDER`          | `order: number`                 | Explicit ordering (lower first).                                                                                                                  |
| `@ui.form.type "name"`               | `UI_FORM_TYPE`           | `type: string`                  | Form-side renderer-type override. Built-in ids only; see `@ui.type`.                                                                              |
| `@ui.form.component "name"`          | `UI_FORM_COMPONENT`      | `name: string`                  | **Named component override** for custom renderers — looked up in the `components` map. `nodeType` adds `interface`. Wins over every `@ui.*.type`. |
| `@ui.form.attr "name", "value"`      | `UI_FORM_ATTR`           | `name: string, value: string`   | Custom attribute / prop on the input; **multiple, replace**. Passed via v-bind.                                                                   |
| `@ui.form.submit.text "text"`        | `UI_FORM_SUBMIT_TEXT`    | `text: string`                  | Submit button label. `nodeType: ["interface", "type"]` (top-level only).                                                                          |
| `@ui.form.label.singular "noun"`     | `UI_FORM_LABEL_SINGULAR` | `singular: string`              | Singular form for array fields — drives `Add <singular>` / `Remove <singular>` / per-item `#N` labels. Defaults to `"item"`.                      |
| `@ui.form.action "id", "label"?`     | `UI_FORM_ACTION`         | `id: string, label?: string`    | Form action button. Label falls back to `@meta.label`.                                                                                            |

## @ui.form.grid.\*

| Annotation                                   | Constant                | Arguments                          | Notes                                                                                                                                           |
| -------------------------------------------- | ----------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ui.form.grid.colSpan "desktop", "narrow"?` | `UI_FORM_GRID_COL_SPAN` | `desktop: string, narrow?: string` | Values: `"1"`..`"12"`, `"full"` (12), `"half"` (6), `"third"` (4). `narrow` applies to containers ≤480px and defaults to `"full"` when omitted. |
| `@ui.form.grid.rowSpan "desktop", "narrow"?` | `UI_FORM_GRID_ROW_SPAN` | `desktop: string, narrow?: string` | Values: `"1"`..`"6"`. `narrow` defaults to `"1"`.                                                                                               |

## @ui.form.prefix._ / @ui.form.suffix._

Adornments rendered around the input value. Order is `[prefix-icon][prefix-text][input][suffix-text][suffix-icon]`.

| Annotation                     | Constant              | Argument        | Notes                                                                                                     |
| ------------------------------ | --------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| `@ui.form.prefix "text"`       | `UI_FORM_PREFIX`      | `value: string` | Literal prefix. Wins over currency from `@db.amount.currency*`.                                           |
| `@ui.form.prefix.ref "field"`  | `UI_FORM_PREFIX_REF`  | `field: string` | Sibling-field path whose runtime value drives the prefix. Static `prefix` wins when both set.             |
| `@ui.form.prefix.icon "class"` | `UI_FORM_PREFIX_ICON` | `class: string` | CSS class painting an icon glyph (typically a `i-mdi-*` preset-icons utility). Consumer manages safelist. |
| `@ui.form.suffix "text"`       | `UI_FORM_SUFFIX`      | `value: string` | Literal suffix. Wins over unit from `@db.unit*`.                                                          |
| `@ui.form.suffix.ref "field"`  | `UI_FORM_SUFFIX_REF`  | `field: string` | Sibling-field path whose runtime value drives the suffix.                                                 |
| `@ui.form.suffix.icon "class"` | `UI_FORM_SUFFIX_ICON` | `class: string` | Icon glyph class.                                                                                         |

## @ui.form.fn.\* (dynamic — requires @atscript/ui-fns)

Computed at render time. Argument is a JS function string compiled with `new Function`. Field-level fn signature: `(value, data, context, entry) => result`. The `TFnScope` shape passed to compiled functions is `{ v, data, context, entry, action? }` (`packages/ui-fns/src/runtime/types.ts:8`).

| Annotation                      | Constant                 | Return                              | What it controls                                                            |
| ------------------------------- | ------------------------ | ----------------------------------- | --------------------------------------------------------------------------- |
| `@ui.form.fn.label "fn"`        | `UI_FORM_FN_LABEL`       | `string`                            | Computed label.                                                             |
| `@ui.form.fn.description "fn"`  | `UI_FORM_FN_DESCRIPTION` | `string`                            | Computed description.                                                       |
| `@ui.form.fn.hint "fn"`         | `UI_FORM_FN_HINT`        | `string`                            | Computed hint.                                                              |
| `@ui.form.fn.placeholder "fn"`  | `UI_FORM_FN_PLACEHOLDER` | `string`                            | Computed placeholder.                                                       |
| `@ui.form.fn.disabled "fn"`     | `UI_FORM_FN_DISABLED`    | `boolean`                           | Computed disabled state.                                                    |
| `@ui.form.fn.hidden "fn"`       | `UI_FORM_FN_HIDDEN`      | `boolean`                           | Computed hidden state.                                                      |
| `@ui.form.fn.readonly "fn"`     | `UI_FORM_FN_READONLY`    | `boolean`                           | Computed readonly state.                                                    |
| `@ui.form.fn.value "fn"`        | `UI_FORM_FN_VALUE`       | `any`                               | Computed default value.                                                     |
| `@ui.form.fn.classes "fn"`      | `UI_FORM_FN_CLASSES`     | `string \| Record<string, boolean>` | Computed CSS classes.                                                       |
| `@ui.form.fn.styles "fn"`       | `UI_FORM_FN_STYLES`      | `string \| Record<string, string>`  | Computed inline styles.                                                     |
| `@ui.form.fn.options "fn"`      | `UI_FORM_FN_OPTIONS`     | `Array<TFormEntryOptions>`          | Computed select/radio options.                                              |
| `@ui.form.fn.attr "name", "fn"` | `UI_FORM_FN_ATTR`        | per-attr `any`                      | Computed attribute/prop. **multiple, replace**. Stored as `[{ name, fn }]`. |

**Form-level** (top scope `(data, context) => result`; `nodeType: ["interface", "type"]`):

| Annotation                         | Constant                     | Return    |
| ---------------------------------- | ---------------------------- | --------- |
| `@ui.form.fn.title "fn"`           | `UI_FORM_FN_TITLE`           | `string`  |
| `@ui.form.fn.submit.text "fn"`     | `UI_FORM_FN_SUBMIT_TEXT`     | `string`  |
| `@ui.form.fn.submit.disabled "fn"` | `UI_FORM_FN_SUBMIT_DISABLED` | `boolean` |

```atscript
@ui.form.fn.disabled "(v, data) => !data.country"
city: string
```

## @ui.form.validate (dynamic)

`@ui.form.validate "fn"` — `UI_FORM_VALIDATE` — custom validator. Returns `true` for pass or an error message string. **Multiple, appended**. Runs before `@expect.*` validation; first non-`true` short-circuits.

```atscript
@ui.form.validate "(v) => v.includes('@') || 'must be an email'"
email: string
```

Signature: `(value, data, context, entry) => true | string`. Validator plugin: `uiFnsValidatorPlugin()` (`packages/ui-fns/src/runtime/validator-plugin.ts:22`).

## @ui.table.\* (static)

All `nodeType: ["prop", "type"]` unless noted.

| Annotation                       | Constant             | Arguments                     | What it controls                                                                                                     |
| -------------------------------- | -------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `@ui.table.width "css"`          | `UI_TABLE_WIDTH`     | `width: string`               | Default column width (any CSS width: `120px`, `15em`, `20ch`). User resize survives; column-menu Reset returns here. |
| `@ui.table.hidden`               | `UI_TABLE_HIDDEN`    | (none)                        | Column hidden by default.                                                                                            |
| `@ui.table.attr "name", "value"` | `UI_TABLE_ATTR`      | `name: string, value: string` | Custom attribute on the rendered `<td>`; **multiple, replace**.                                                      |
| `@ui.table.classes "names"`      | `UI_TABLE_CLASSES`   | `names: string`               | Classes on the cell `<td>`; **multiple, appended**. `nodeType` also `interface`.                                     |
| `@ui.table.styles "css"`         | `UI_TABLE_STYLES`    | `css: string`                 | Inline styles on the cell `<td>`; **multiple, appended**. `nodeType` also `interface`.                               |
| `@ui.table.type "name"`          | `UI_TABLE_TYPE`      | `type: string`                | Table-side renderer-type override (built-in ids only).                                                               |
| `@ui.table.component "name"`     | `UI_TABLE_COMPONENT` | `name: string`                | **Named component override** — looked up in the table `components` map. `nodeType` adds `interface`.                 |
| `@ui.table.order n`              | `UI_TABLE_ORDER`     | `order: number`               | Initial column ordering (lower first). User reorder still mutates `columnNames`.                                     |

## @ui.table.fn.\* (dynamic)

Per-row computed annotations evaluated against `{ row, ctx }` — `row` is the current row's data object, `ctx` carries table-level context with at minimum `searchTerm`, `filters`, `sorters`, `rowIndex`. Per-row+cell scope only; no `hidden`/`width`/`type`/`component`/`order` (those are column-level decisions).

| Annotation                       | Constant              | Return                                 |
| -------------------------------- | --------------------- | -------------------------------------- |
| `@ui.table.fn.attr "name", "fn"` | `UI_TABLE_FN_ATTR`    | per-attr `any`. **multiple, replace**. |
| `@ui.table.fn.classes "fn"`      | `UI_TABLE_FN_CLASSES` | `string \| Record<string, boolean>`    |
| `@ui.table.fn.styles "fn"`       | `UI_TABLE_FN_STYLES`  | `string \| Record<string, string>`     |

```atscript
@ui.table.fn.classes "({ row }) => row.amount < 0 ? 'text-error' : ''"
amount: number
```

## @ui.dict.\* (value-help target)

These live on the **target** type of a value-help reference (the dictionary/lookup table). `@db.rel.FK` on the source field points to a type whose props carry `@ui.dict.*`.

Read server-side by `AsValueHelpController` (`@atscript/moost-db`) and surfaced into the `/meta` response — no extra client wiring needed. (Same pattern as `AsDbReadableController` for `@db.table.filterable/sortable` + `@db.column.filterable/sortable`.)

| Annotation            | Constant             | nodeType            | What it does                                                                                                                      |
| --------------------- | -------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `@ui.dict.label`      | `UI_DICT_LABEL`      | `prop`              | Primary display label in value-help picker.                                                                                       |
| `@ui.dict.descr`      | `UI_DICT_DESCR`      | `prop`              | Secondary description in value-help picker.                                                                                       |
| `@ui.dict.attr`       | `UI_DICT_ATTR`       | `prop`              | Additional attribute column in table-mode value help; **multiple, appended**.                                                     |
| `@ui.dict.filterable` | `UI_DICT_FILTERABLE` | `prop`              | Picker UI shows this column as filterable. Surfaces as `meta.fields[name].filterable`.                                            |
| `@ui.dict.sortable`   | `UI_DICT_SORTABLE`   | `prop`              | Picker UI shows this column as sortable. Surfaces as `meta.fields[name].sortable`.                                                |
| `@ui.dict.searchable` | `UI_DICT_SEARCHABLE` | `prop`, `interface` | Participates in `$search`. On an interface, marks every `string` prop on the target as searchable. Surfaces as `meta.searchable`. |

## @ui.array.\* (array control)

`nodeType: ["prop"]` only.

| Annotation                      | Argument        | Default      | What it controls          |
| ------------------------------- | --------------- | ------------ | ------------------------- |
| `@ui.array.add.label "text"`    | `label: string` | `"Add item"` | Add-item button label.    |
| `@ui.array.remove.label "text"` | `label: string` | `"Remove"`   | Remove-item button label. |

## @wf.\* (workflow side)

Registered by `wfPlugin()` from `@atscript/moost-wf/plugin` (`packages/moost-wf/src/plugin.ts:24`). All require the workflow runtime — install the plugin in `atscript.config.ts` server-side.

| Annotation                     | Argument                            | nodeType            | Where it's read                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ----------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@wf.context.pass "key"`       | `key: string`; **multiple, append** | `interface`, `type` | `serializeFormSchema` strips context.pass-listed keys from the wire payload. Whitelist of context keys to pass to the client form — only listed keys are extracted from workflow state and included in the `inputRequired` response. Prevents leaking internal state to the browser.                                                                                                                                                                                                                                                                            |
| `@wf.action.withData "id"`     | `id: string`                        | `prop`, `type`      | Drives action validation with `deepPartial=true` — accepts partial form data. Use for "save draft" / soft-validated actions.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `@wf.store.fromContext "path"` | `path: string`                      | `prop`              | At `AsWfStore.set()` the wf-state row gets a shadow top-level column whose value is copied from `state.context.<path>`. Path is plain dot-notation (`a.b`) — no array indices / wildcards / bracket access. PKs (`@meta.id`) are rejected. Field must be optional or carry `@meta.default` / `@db.default` (context shape varies between steps and path-misses write null). Field's resolved primitive must be `string \| number \| boolean` — no arrays, objects, decimal, or timestamp. Validated at compile time (`packages/moost-wf/src/plugin.ts:90-158`). |

```atscript
@wf.context.pass 'tenant'
@wf.context.pass 'role'
interface ApprovalFlow {
  @meta.id id: string

  approver?: string  @wf.store.fromContext 'approval.approver'

  @wf.action.withData 'saveDraft'
  saveDraft: action
}
```

Constant: `WF_ACTION_WITH_DATA` (`wf.action.withData`). `wf.context.pass` and `wf.store.fromContext` have no exported constants in `@atscript/ui` — only `wf.action.withData` is referenced from form-side consumers.

## @meta._ and @expect._ that vue-form/vue-table consume

These come from `@atscript/core` — full reference in the `atscript` skill. Subset relevant to forms/tables:

| Annotation                        | Constant in `@atscript/ui` | Used by                                                                                                           |
| --------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `@meta.label "text"`              | `META_LABEL`               | Form label, table column header.                                                                                  |
| `@meta.description "text"`        | `META_DESCRIPTION`         | Form field description, table column tooltip.                                                                     |
| `@meta.required`                  | `META_REQUIRED`            | Form required marker, validator.                                                                                  |
| `@meta.default <value>`           | `META_DEFAULT`             | Form initial value, primitive init fallback.                                                                      |
| `@meta.id`                        | `META_ID`                  | Primary-key marker. Rejected by `@wf.store.fromContext`.                                                          |
| `@meta.readonly`                  | `META_READONLY`            | Form readonly.                                                                                                    |
| `@meta.sensitive`                 | `META_SENSITIVE`           | Marks values that must be masked (e.g. passwords).                                                                |
| `@expect.minLength n`             | (no const)                 | String/array min length.                                                                                          |
| `@expect.maxLength n`             | `EXPECT_MAX_LENGTH`        | Used by `computeDefaultColumnWidth` to derive table column width.                                                 |
| `@expect.min n` / `@expect.max n` | (no const)                 | Numeric bounds.                                                                                                   |
| `@expect.pattern "re"`            | (no const)                 | Regex validation.                                                                                                 |
| `?:` (optional prop syntax)       | —                          | Drives `ColumnDef.nullable` (drops `null` / `notNull` filter ops on non-nullable cols), and form optional toggle. |

See the `atscript` skill for the full list of `@meta.*` / `@expect.*` annotations.

## @db.\* that vue-form/vue-table consume

These come from `@atscript/db/plugin`. Subset surfaced via vue-form / vue-table:

| Annotation                              | Constant in `@atscript/ui`                     | Where it's read                                                                                                     |
| --------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@db.rel.FK "TargetType"`               | `DB_REL_FK`                                    | Foreign-key marker. Drives `extractValueHelp(prop)` → `ValueHelpInfo`.                                              |
| `@db.http.path "/route"`                | `DB_HTTP_PATH`                                 | HTTP path for the value-help target's `/meta` endpoint.                                                             |
| `@db.amount.currency "EUR"`             | `DB_AMOUNT_CURRENCY`                           | Literal ISO currency code. Mapped to `ColumnDef.currencyCode`; drives form `$` prefix and table cell formatting.    |
| `@db.amount.currency.ref "field"`       | `DB_AMOUNT_CURRENCY_REF`                       | Sibling-field reference for currency code. Mapped to `ColumnDef.currencyRefField`.                                  |
| `@db.unit "kg"`                         | `DB_UNIT`                                      | Literal unit-of-measure. Mapped to `ColumnDef.unitCode`; drives suffix.                                             |
| `@db.unit.ref "field"`                  | `DB_UNIT_REF`                                  | Sibling-field reference for unit. Mapped to `ColumnDef.unitRefField`.                                               |
| `@db.column.precision precision, scale` | `DB_COLUMN_PRECISION`                          | Decimal precision/scale; `scale` mapped to `ColumnDef.precisionScale` and used by decimal cell + input enforcement. |
| `@db.index.fulltext`                    | (no const — read by `MetaResponse.searchable`) | Marks the table as searchable; surfaces as `meta.searchable=true`.                                                  |

`@db.amount.*` and `@db.unit.*` only contribute a prefix/suffix when **no** explicit `@ui.form.prefix*` / `@ui.form.suffix*` is set on the prop.

Full reference in the `atscript-db` skill.

## Resolution precedence

**Form component dispatch** (`packages/vue-form/src/components/as-field.vue:373-386`):

```text
@ui.form.component (named in components map)
  > @ui.form.type / @ui.type (structural-kind override stored as customType on FormFieldDef)
  > FormFieldDef.type (the structural type — 'array', 'object', 'union', 'tuple', or a primitive)
```

For primitives, `customType` is undefined: any `@ui.form.type` value is folded into `FormFieldDef.type` directly at `createFormDef` time so the single-key lookup in the types map still matches. For structured kinds (array/object/union/tuple) the override goes into `customType` so the structural type guards (`isArrayField`, `isObjectField`, `isUnionField`, `isTupleField`) keep working downstream.

**Table cell dispatch** mirrors this — `ColumnDef.component` (from `@ui.table.component`) wins, then `ColumnDef.type` (from `@ui.table.type` → `@ui.type` → inferred from `designType`).

**Static vs dynamic resolution** (`packages/ui/src/shared/field-resolver.ts`):

- `StaticFieldResolver` (default) reads only static metadata; ignores fn keys and returns `undefined`. `hasComputedAnnotations()` always `false`.
- `DynamicFieldResolver` (from `@atscript/ui-fns`, activated via `installDynamicResolver()`) reads the fn key first; if a compiled fn returns a non-`undefined` value, use it; otherwise fall back to the static key.
- Both resolvers honour `TResolveOptions`: `staticAsBoolean` coerces any non-`undefined` static value to `true`; `transform(raw)` lets the caller post-process the static value.

**Prefix/suffix conflicts**: literal `@ui.form.prefix` wins over `@ui.form.prefix.ref` (both wins over `@db.amount.currency*`). Same for suffix vs `@db.unit*`.
