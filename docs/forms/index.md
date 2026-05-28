---
outline: deep
---

# Forms

`@atscript/vue-form` renders Vue 3 forms directly from an annotated `.as`
type. You write the type once — labels, defaults, validation, layout,
field components and submit text all flow from the same source of truth.
No render boilerplate, no field-by-field wiring, no schema duplication
between the form and the API contract that consumes it.

## Mental model

The pipeline is three short steps:

```text
.as type  →  FormDef  →  <AsForm>
 (source)    (parsed)    (rendered)
```

1. **`.as` type.** A normal atscript interface decorated with `@meta.*`,
   `@expect.*`, `@ui.form.*` and optionally `@ui.form.fn.*` (dynamic).
   See [atscript.dev](https://atscript.dev) for the language; see
   [Annotations](/forms/annotations) for everything vue-form reads.

2. **`createAsFormDef(MyType)`.** A one-liner that parses the type into
   a framework-agnostic `FormDef` (from `@atscript/ui`) and returns a
   reactive `formData` container shaped as `{ value: domainData }`.

3. **`<AsForm :def :form-data :types @submit>`.** The Tier-1 component.
   It walks the FormDef and dispatches each field to a Vue component
   from the `types` map (defaults + your overrides).

## Component tiers

Every component in `vue-form` lives in one of three tiers (see
`CLAUDE.md`):

- **Tier 1 — Primary.** What users tag in templates: `AsForm`,
  `AsField`, `AsIterator`. Auto-resolved by `AsResolver()`.
- **Tier 2 — Defaults.** Swappable via `:types` or `:components`:
  `AsInput`, `AsNumber`, `AsDecimal`, `AsSelect`, `AsRadio`,
  `AsCheckbox`, `AsDate`, `AsDatetime`, `AsTime`, `AsParagraph`,
  `AsAction`, `AsObject`, `AsArray`, `AsUnion`, `AsTuple`, `AsRef`,
  `AsFieldShell`. Importable from `@atscript/vue-form`, not
  auto-imported.
- **Tier 3 — Internals.** Composition helpers. Not exported.

You will spend most of your time in Tier 1 + annotations. Reach for
Tier 2 when you want to replace a default renderer; reach for the
`types` map when you want to register a brand-new field type.

## Where to go next

- [Hello World](/forms/hello-world) — a full working form in 25 lines.
- [Annotations](/forms/annotations) — the authoritative reference for
  every `@meta.*`, `@expect.*`, `@ui.form.*` and `@ui.form.fn.*` key
  vue-form reads.
- [Field Types](/forms/field-types) — the default type map and how
  component resolution works.
- [Validation](/forms/validation) — `@expect.*`, custom rules, external
  errors, fresh-field strategies.
- [Arrays](/forms/arrays), [Nested Objects](/forms/nested-objects),
  [Unions](/forms/unions), [Tuples](/forms/tuples) — structured fields.
- [Dynamic Fields](/forms/dynamic-fields) — `@ui.form.fn.*` JS
  expressions (requires `@atscript/ui-fns`).
- [Grid Layout](/forms/grid-layout), [Actions](/forms/actions),
  [References](/forms/references) — layout, submit/server actions, FK
  pickers.
- [Customization](/forms/customization),
  [Custom Components](/forms/custom-components),
  [Locale](/forms/locale) — make it yours.
- [Aooth Components](/forms/aooth-components) — pre-built field
  components for consent collection, password rules, QR-code enrolment
  and one-shot copy values, shipped by `@atscript/vue-aooth`.

::: tip Related ecosystem docs
The `.as` language, `asc` CLI, `@meta.*`, `@expect.*` and validators
live in the [atscript core docs](https://atscript.dev). The `@db.*`
annotations (FK, currency, units, precision) are covered in the
[atscript-db docs](https://db.atscript.dev). vue-form reads several
of them too — see [References](/forms/references) and
[Annotations](/forms/annotations#db-annotations-cross-cutting).
:::
