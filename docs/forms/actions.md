# Actions

Forms ship with a single Submit button by default. To add extra buttons —
"Save draft", "Discard", "Send for review", workflow step transitions — declare
them as **phantom fields** annotated with `@ui.form.action`. The form renders a
button per action and emits an `action` event when the user clicks it. No data
is collected for these fields.

## The annotation

```atscript
@ui.form.action 'actionId', 'Button label'
fieldName: ui.action
```

- `'actionId'` is the id emitted back to the host.
- `'Button label'` is the rendered text.
- The `ui.action` primitive marks the field as a phantom — no value is stored
  on `formData`, no validator runs.

## Listen with `@action`

`<AsForm>` emits `action` with the id and the current form data:

```vue
<script setup lang="ts">
import { AsForm, createDefaultTypes, createAsFormDef } from '@atscript/vue-form'
import { OrderForm } from './order-form.as'

const { def, formData } = createAsFormDef(OrderForm)
const types = createDefaultTypes()

function onAction(name: string, data: unknown) {
  if (name === 'save-draft') saveDraft(data)
  if (name === 'discard') resetForm()
}

function onSubmit(data: unknown) {
  submitOrder(data)
}
</script>

<template>
  <AsForm
    :def="def"
    :form-data="formData"
    :types="types"
    @submit="onSubmit"
    @action="onAction"
  />
</template>
```

The `action` event signature is `(name: string, data: TFormData) => void` —
see `useAsForm`'s emits contract in
`packages/vue-form/src/composables/use-as-form.ts`.

## Multi-action form

```atscript
@meta.label 'Order'
export interface OrderForm {
    @meta.label 'Item'
    item: string

    @meta.label 'Quantity'
    quantity: number

    @ui.form.action 'save-draft', 'Save draft'
    saveDraft: ui.action

    @ui.form.action 'discard', 'Discard'
    discard: ui.action
}
```

Submit still works as usual. The phantom action fields render as additional
buttons inline with the form. Use grid annotations to control their placement:

```atscript
@ui.form.action 'save-draft', 'Save draft'
@ui.form.grid.colSpan '6'
saveDraft: ui.action

@ui.form.action 'discard', 'Discard'
@ui.form.grid.colSpan '6'
discard: ui.action
```

## Customising the Submit button

The Submit button is rendered by `<AsForm>` itself (not a phantom field). Two
annotations on the root interface customise it:

```atscript
@meta.label 'Registration'
@ui.form.submit.text 'Register'
@ui.form.fn.submit.disabled '(data) => !data.email'
export interface Registration { ... }
```

- `@ui.form.submit.text` — static label
- `@ui.form.fn.submit.text` — dynamic label (requires `@atscript/ui-fns`)
- `@ui.form.fn.submit.disabled` — dynamic disabled state

To suppress the built-in Submit button entirely (host chrome owns it):

```vue
<AsForm :def="def" :form-data="formData" :types="types" hide-submit />
```

Or override the slot:

```vue
<AsForm :def="def" :form-data="formData" :types="types">
  <template #form.submit="{ disabled, text }">
    <MyPrimaryButton type="submit" :disabled>{{ text }}</MyPrimaryButton>
  </template>
</AsForm>
```

## Unsupported actions

When the emitted action id doesn't match any `@ui.form.action` (or
`@wf.action.withData`) in the def, `<AsForm>` fires
`unsupported-action` instead of `action`. Useful as a no-op guard rail when
controllers refactor action ids.

```vue
<AsForm
  @action="onAction"
  @unsupported-action="(name) => console.warn('Unknown action:', name)"
/>
```

## Workflow actions

In a workflow form (`<AsWfForm>`, see [Workflow basics](/workflows/basics)),
`@wf.action.withData` is a workflow-aware variant of `@ui.form.action` that
includes the form data with the action invocation. It's recognised by the same
action-routing pipeline — see [Workflow actions](/workflows/actions) for the
full picture.

## The AsAction component

The default `AsAction` component (Tier 2 swap target) is intentionally minimal:
a `<button type="button">` that emits `action` with its `formAction.id`. Swap it
through the `:types` map to use your design system's button:

```vue
<script setup lang="ts">
import { createDefaultTypes } from '@atscript/vue-form'
import MyActionButton from './MyActionButton.vue'

const types = { ...createDefaultTypes(), action: MyActionButton }
</script>
```

The custom component receives the standard `TAsComponentProps` contract —
inspect `formAction` for the id and label, and emit `'action'` with the id:

```vue
<script setup lang="ts">
import type { TAsComponentProps, TAsComponentEmits } from '@atscript/vue-form'

defineProps<TAsComponentProps>()
const emit = defineEmits<TAsComponentEmits>()
</script>

<template>
  <button
    type="button"
    class="c8-light"
    @click="formAction && emit('action', formAction.id)"
  >
    {{ formAction?.label }}
  </button>
</template>
```

See [Custom field components](/forms/custom-components) for the full
`TAsComponentProps` contract.

## Next steps

- [Customization](/forms/customization) — override `AsAction` globally
- [Dynamic fields](/forms/dynamic-fields) — `@ui.form.fn.submit.disabled` and friends
- [Workflow actions](/workflows/actions) — `@wf.action.withData` for partial-data flows
