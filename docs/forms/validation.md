---
outline: deep
---

# Validation

Forms in `vue-form` are validated end-to-end without writing a single
schema by hand. Every rule lives on the `.as` type as an annotation,
runs through the atscript validator, and surfaces in the UI through
`AsField`. This page covers the three rule layers, how live validation
fires, fresh-field behaviour and how to merge server-side errors.

## Three layers of rules

```text
@expect.*         (declarative constraints — runs through Validator)
   ▼
@meta.required    (non-empty check + label * marker)
   ▼
@ui.form.validate (custom JS expression — requires @atscript/ui-fns)
```

### Layer 1: `@expect.*`

Defined by atscript core. vue-form just hands them to
`getFormValidator(def)`
(`packages/vue-form/src/composables/use-as-form.ts:178-180`) and walks
the result.

```atscript
@meta.label 'Username'
@meta.required 'Username is required'
@expect.minLength 3, 'Must be at least 3 characters'
@expect.maxLength 20, 'Must be at most 20 characters'
username: string
```

`@expect.min` / `@expect.max` work for numbers and dates
(`@expect.exclusiveMin` / `@expect.exclusiveMax` reject the bound itself);
`@expect.minLength` / `@expect.maxLength` for strings and arrays;
`@expect.pattern` for regex.

### Layer 2: `@meta.required`

The validation message is a positional argument:

```atscript
@meta.required 'Email is required'
email: string.email
```

A required field with a non-string-format failure surfaces the
`required` message; a format failure (e.g. malformed email) surfaces
the validator's format-specific message.

::: tip Optional + required
`field?: string` with `@meta.required` means "if present, can't be
empty". vue-form does **not** paint the required marker on these.

Since atscript 0.1.103 such a field rejects `null` (it may only be
omitted). An emptied date, datetime, time, number or decimal input on an
optional field therefore commits `undefined` (since 0.1.153); on a
non-optional field it keeps committing `null`. Declare the field
`field?: string | null` when `null` is a value your API accepts.
:::

### Layer 3: `@ui.form.validate`

Custom JS expression evaluated against `(value, data, context)`. Return
`true` for pass or a string for error. Requires `@atscript/ui-fns` to
parse the expression.

```atscript
@meta.label 'Password'
@meta.required 'Password is required'
@expect.minLength 8, 'Password must be at least 8 characters'
@ui.form.validate '(v) => /[A-Z]/.test(v) || "Must contain an uppercase letter"'
password: string

@meta.label 'I agree to terms'
@ui.form.validate '(v) => !!v || "You must agree to terms"'
agreeToTerms: ui.checkbox
```

Multiple custom validators on one field run in order — the first
failing one short-circuits.

#### Cross-field validators

The second argument is the full (unwrapped) form data — read sibling
fields to express constraints across the form. The same rule runs on
every keystroke (subject to the `firstValidation` strategy) and on
submit, so the field stays in sync as either side changes.

```atscript
@meta.label 'New password'
newPassword: string

@meta.label 'Confirm password'
@ui.form.validate '(v, data) => v === data.newPassword || "Passwords must match"'
confirmPassword: string
```

For a constraint that depends on multiple fields at once, prefer a
[form-level validator](#form-level-errors) — it reports in the
form-level banner instead of under one of the fields.

## A complete example

A `ValidationForm.as` schema that exercises all three layers in one type:

```atscript
@meta.label 'Validation Demo'
@ui.form.submit.text 'Validate & Submit'
export interface ValidationForm {
    @meta.label 'Username'
    @meta.required 'Username is required'
    @expect.minLength 3, 'Must be at least 3 characters'
    @expect.maxLength 20, 'Must be at most 20 characters'
    username: string

    @meta.label 'Email'
    @meta.required 'Email is required'
    email: string.email

    @meta.label 'Age'
    @ui.form.validate '(v) => !!v || "Age is required"'
    @expect.min 18, 'Must be 18 or older'
    @expect.max 120, 'Must be 120 or younger'
    age?: number

    @meta.label 'Password'
    @meta.required 'Password is required'
    @expect.minLength 8, 'Password must be at least 8 characters'
    @ui.form.validate '(v) => /[A-Z]/.test(v) || "Must contain an uppercase letter"'
    password: string

    @meta.label 'I agree to terms'
    @ui.form.validate '(v) => !!v || "You must agree to terms"'
    agreeToTerms: ui.checkbox

    @meta.label 'Tags'
    @expect.minLength 1, 'At least one tag required'
    @expect.maxLength 5, 'Maximum 5 tags'
    tags: string[]
}
```

Mount it the same way as any form:

```vue
<script setup lang="ts">
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import { ValidationForm } from "./ValidationForm.as";

const types = createDefaultTypes();
const { def, formData } = createAsFormDef(ValidationForm);
</script>

<template>
  <AsForm
    :def="def"
    :form-data="formData"
    :types="types"
    @submit="(data) => console.log('valid:', data)"
    @error="(errs) => console.warn('invalid:', errs)"
  />
</template>
```

## When does validation fire?

Each field decides per-keystroke whether it's "validation-active" based
on the form's `firstValidation` strategy
(`packages/vue-form/src/composables/use-as-field.ts:62-77`):

| Strategy          | Becomes active after…                  |
| ----------------- | -------------------------------------- |
| `on-change`       | first submit OR first edit (default)   |
| `touched-on-blur` | first submit OR (edited AND blurred)   |
| `on-blur`         | first submit OR first blur             |
| `on-submit`       | first submit only                      |
| `none`            | never (validation suppressed entirely) |

Pass it as a prop:

```vue
<AsForm :def="def" :form-data="formData" :types="types" first-validation="touched-on-blur" />
```

On **submit**, the entire form validates synchronously — every field
with a rule runs, errors collect, and either `@submit` (clean) or
`@error` (dirty) fires. Sections containing errors auto-expand so the
user can see what went wrong
(`use-as-form.ts:238-248`).

::: info Default is `on-change`
After the first edit on a leaf field, errors update on every
keystroke. Until the user types, validation is silent.
:::

## Fresh fields

Newly-mounted fields are marked **fresh** until the user edits them or
submits again
(`packages/vue-form/src/composables/use-as-state.ts:32-38`). This
prevents a freshly-added array item from lighting up every required
field red the moment it renders.

A field stops being fresh when:

- the user types into it,
- the user tabs through it (blur counts),
- the form submits.

You don't configure freshness — it's automatic for every leaf field.

## External errors

Server-side validation errors land in the form via the `:errors` prop.
The shape is `Record<absolutePath, message>`. Use `__form` as the key
for a form-level banner.

```vue
<AsForm :def="def" :form-data="formData" :types="types" :errors="serverErrors" />
```

```ts
const serverErrors = {
  "address.street": "Unknown address",
  "phones.0.number": "Invalid format",
  __form: "Could not save — please try again",
};
```

External errors **auto-dismiss** as the user edits the offending
field (`as-field.vue:677-683`). The form-level banner has its own
explicit dismiss button. Programmatic dismissal is available via
`useAsForm()`'s `dismissError(path)` and `dismissFormError()`.

For arrays / unions / structured fields the dismissal still works —
any descendant mutation drops the ancestor error from the internal
map too (`use-as-form.ts:302-323`).

If your host maintains its own `serverErrors` map and prunes entries
as they get resolved, use
[`omitPaths(errors, paths)`](/api/ui#error-map-utilities) from
`@atscript/ui`. It is identity-preserving — when no key matched it
returns the _same_ object, so a no-op prune doesn't hand the form a
fresh `:errors` reference and resurrect errors the user already
dismissed by editing.

## Form-level errors

Put `@ui.form.validate` on the interface itself to get a form-level
rule (_since 0.1.158_). The function receives the same `(value, data, context, entry)`
arguments as a field rule, with `value` set to the whole object. On the
form's root interface `value` and `data` are the same object.

```atscript
@ui.form.validate '(v) => v.password === v.confirm || "Passwords must match"'
export interface SignupForm {
    @meta.label 'Password'
    @meta.required 'Password is required'
    password: string

    @meta.label 'Confirm password'
    confirm: string
}
```

When the form's root interface carries the rule:

- it runs on submit. A failing rule blocks `@submit`, and the message
  shows in the form-level banner above the submit button (the same
  banner and `formError` slot prop as an external `__form` error);
- `@error` reports it with the path `__form`;
- field rules still run. Their errors show on their fields, in the same
  `@error` payload, and never in the banner;
- after the first submit the rule is re-checked as the data changes, so
  the banner clears as soon as the data passes;
- the banner's dismiss button hides it until the next submit;
- while it fails, it is shown instead of an external `__form` error.

### The same interface as a nested object

When another form uses the interface as a nested object prop, its rule
belongs to that prop. It does not become a form-level error there:

```atscript
export interface AccountForm {
    @meta.label 'Title'
    title: string

    @meta.label 'Sign-up'
    signup: SignupForm
}
```

Here a mismatch is reported at the path `signup`. It shows on the
`signup` section and counts in that section's error badge.

::: tip Use `value`, not `data`, in a container rule
`data` is always the whole form's data. `data.password` works while
`SignupForm` is the form root, but is `undefined` when `SignupForm` is
nested under `signup`. Read the object's own fields from `value` (`v`)
so the rule works in both places.
:::

### Form-level errors from the server

To show a server error in the same banner, set `__form` from your
submit handler:

```ts
async function onSubmit(data: SignupForm) {
  try {
    await api.signup(data);
  } catch (e) {
    serverErrors.value = { __form: e.message };
  }
}
```

## Programmatic control

The slots on `<AsForm>` expose imperative helpers (see
`use-as-form.ts:108-141`):

```vue
<AsForm :def="def" :form-data="formData" :types="types">
  <template #form.header="{ reset, clearErrors, setErrors }">
    <div class="form-toolbar">
      <button type="button" @click="reset">Reset</button>
      <button type="button" @click="clearErrors">Clear errors</button>
    </div>
  </template>
</AsForm>
```

- `reset()` — re-applies type defaults, clears all errors.
- `clearErrors()` — clears all error state without touching values:
  per-field (touched / blur / submit / external) plus the form-level
  submit map that feeds descendant error-count badges.
- `setErrors({ path: msg })` — push errors from outside the form (e.g.
  after a server response).

`clearErrors` and `setErrors` are also exposed on the `<AsForm>`
template ref (alongside `submit`, `reset`, and the change-tracking
surface), so a host shell can drive them without slot plumbing:

```ts
const formRef = ref<InstanceType<typeof AsForm>>();
formRef.value?.clearErrors();
formRef.value?.setErrors({ "address.street": "Unknown address" });
```

## Action-vs-submit

Form actions (`AsAction` fields) fire `@action` instead of `@submit`
and do **not** validate the entire form by default. See
[Actions](/forms/actions) for action lifecycles and validation
opt-ins.

## Next steps

- [Annotations](/forms/annotations) — full `@expect.*` /
  `@ui.form.validate` reference.
- [Dynamic Fields](/forms/dynamic-fields) — the `@ui.form.fn.*`
  family, including dynamic disabled / hidden that participate in
  validation.
- [Arrays](/forms/arrays) — array-specific length constraints.
