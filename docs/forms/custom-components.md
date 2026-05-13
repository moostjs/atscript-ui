# Building Custom Field Components

`AsField` resolves each field's metadata, picks the right component, and passes
**the full resolved field state** as props. A custom field component is any Vue
3 component that accepts the `TAsComponentProps<T>` contract.

This page is the reference for the contract, the typical skeleton, the built-in
composables you can pull in, and a complete worked example. For when to use
custom components, see [Customization](/forms/customization).

## The contract

Every field component receives a `TAsComponentProps<T>` interface (declared in
`packages/vue-form/src/components/types.ts`). `T` is the field's value type:
`string`, `number`, `string[]`, etc.

```typescript
import type { TAsComponentProps, TAsComponentEmits } from "@atscript/vue-form";

defineProps<TAsComponentProps<string | null | undefined>>();
defineEmits<TAsComponentEmits>();
```

Annotated breakdown of the props you'll touch most:

| Prop                        | Meaning                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| `model`                     | `{ value: T }` — bind with `v-model="model.value"`                         |
| `label`                     | Resolved label (`@meta.label` / `@ui.form.fn.label`)                       |
| `description`               | Resolved description                                                       |
| `hint`                      | Resolved hint                                                              |
| `placeholder`               | Resolved placeholder                                                       |
| `disabled`                  | Resolved `@ui.form.disabled` / `@ui.form.fn.disabled`                      |
| `hidden`                    | Resolved `@ui.form.hidden` / `@ui.form.fn.hidden`                          |
| `readonly`                  | Resolved `@meta.readonly` / `@ui.form.fn.readonly`                         |
| `required` / `optional`     | Mirror each other; true/false for required-status                          |
| `onToggleOptional`          | Callable when `optional` is true — `true` sets default, `false` sets undef |
| `error`                     | Current validation error message                                           |
| `errorId` / `descId`        | Stable ids for `aria-describedby` wiring                                   |
| `inputId`                   | Stable id for `<label :for>` on your inner control                         |
| `ariaDescribedBy`           | Pre-resolved — bind directly to `aria-describedby`                         |
| `type`                      | Resolved field type string                                                 |
| `name`                      | Last segment of the field's dotted path                                    |
| `path`                      | Absolute dotted path inside form data                                      |
| `field`                     | Full `FormFieldDef` for advanced inspection                                |
| `formAction`                | For phantom action fields — `{ id, label }`                                |
| `options`                   | Resolved options for select/radio/checkbox                                 |
| `valueHelp`                 | FK ref descriptor (`ValueHelpInfo`)                                        |
| `singularLabel`             | From `@ui.form.label.singular` — used by arrays                            |
| `prefix` / `suffix`         | Resolved adornment text                                                    |
| `prefixIcon` / `suffixIcon` | Resolved adornment icon class                                              |
| `currencyCode`              | Resolved currency code (post sibling-ref)                                  |
| `unitCode`                  | Resolved unit code (post sibling-ref)                                      |
| `scale`                     | Effective display scale for decimals                                       |
| `hasAdornment`              | True when at least one adornment annotation is set                         |
| `arrayIndex`                | Index when rendered as a direct array item                                 |
| `onRemove`                  | Callback to remove this array item (only present inside arrays)            |
| `canRemove`                 | Whether removal respects `minLength` constraints                           |
| `removeLabel`               | Label for the remove button (`@ui.array.remove.label`)                     |
| `level`                     | Nesting depth (0 at root, increments per nested object/array)              |
| `onBlur`                    | Call when your control blurs — triggers field validation                   |

The complete list (and forward-compat fields) is in
`packages/vue-form/src/components/types.ts`.

## Emits

```typescript
interface TAsComponentEmits<_V = unknown> {
  (e: "action", name: string): void;
}
```

Only relevant when your component is registered as the `action` renderer or
emits other workflow actions. Forward the id through to `<AsForm>`'s `@action`
handler.

## Skeleton

The minimum viable custom field component, wrapped with `AsFieldShell` to
inherit standard label/error chrome:

```vue
<script setup lang="ts" generic="T">
import { AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps<T>>();

function commit(next: T): void {
  props.model.value = next;
}
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <!-- your control, bound to model.value, plus :id="inputId" -->
      <input
        :id="inputId"
        :value="model.value"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :aria-required="required || undefined"
        :aria-invalid="!!error || undefined"
        :aria-describedby="ariaDescribedBy"
        @input="commit(($event.target as HTMLInputElement).value as T)"
        @blur="onBlur"
      />
    </template>
  </AsFieldShell>
</template>
```

Notes:

- `v-bind="$props"` forwards every contract prop to the shell so it can render
  label/description/error/optional toggle.
- The shell exposes the resolved `inputId` via the default slot scope — put it
  on your innermost control so the shell's `<label :for>` works.
- `onBlur` is a prop (not an emit). Call it from your control's blur handler.

## Useful composables inside a custom component

These are exported from `@atscript/vue-form` and safe to call inside any custom
field rendered as a descendant of `<AsForm>`.

### `useAsField`

The field-level state machine — model wrapper, validator pipeline, error
resolution, blur tracking. Use it when your component owns its own commit
path instead of routing through `<AsField>`:

```typescript
import { useAsField } from '@atscript/vue-form'

const props = defineProps<{ field: FormFieldDef; path: string }>()

const { model, error, onBlur } = useAsField<string>({
  getValue: () => /* read your value */,
  setValue: (v) => /* write your value */,
  rules: [(v) => !!v || 'Required'],
  path: () => props.path,
  resetValue: '',
})
```

Returns `{ model, error, onBlur }`. The composable registers with the parent
`<AsForm>` so the field participates in submit-time validation, reset, and
external-error wiring. See `packages/vue-form/src/composables/use-as-field.ts`
for the full options shape.

### `useAsData`

Reactive read-only access to the same data, including a relative-sibling
helper:

```typescript
import { useAsData } from "@atscript/vue-form";

const { rootData, getValueAt, siblingValue } = useAsData();

const country = siblingValue<string>("country");
// Inside an array item, this resolves to the sibling on the same item.
```

`siblingValue<T>(name)` reads relative to the current `useAsPath()` prefix —
i.e. it walks up to the nearest parent object and reads `name` on it.

### `useAsLocale`

Read the BCP-47 locale provided by `provideAsLocale` at the app root:

```typescript
import { useAsLocale } from "@atscript/vue-form";

const { locale } = useAsLocale();
const fmt = new Intl.NumberFormat(locale.value ?? "en-US");
```

See [Locale & currency](/forms/locale).

### `useAsDate`, `useAsNumber`, `useAsDecimal`, `useAsDualInput`

Higher-level composables for building date / numeric / decimal / merged-input
widgets that mirror the built-ins' behaviour. Useful when you want a different
visual but the same locale-aware parsing.

## Worked example — color swatch picker

A `ColorSwatch.vue` custom field component:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps<string | null | undefined>>();

const PALETTE = [
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#64748b",
] as const;

const buttonRefs = ref<HTMLButtonElement[]>([]);

function pick(hex: string): void {
  props.model.value = hex;
}

function focusIndex(idx: number): void {
  const clamped = (idx + PALETTE.length) % PALETTE.length;
  buttonRefs.value[clamped]?.focus();
}

function onKeyDown(e: KeyboardEvent, idx: number, hex: string): void {
  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
      e.preventDefault();
      focusIndex(idx + 1);
      break;
    case "ArrowLeft":
    case "ArrowUp":
      e.preventDefault();
      focusIndex(idx - 1);
      break;
    case "Enter":
    case " ":
      e.preventDefault();
      pick(hex);
      break;
  }
}

function onGroupBlur(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null;
  const group = e.currentTarget as HTMLElement;
  if (group && next && group.contains(next)) return;
  props.onBlur();
}
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <div
        role="radiogroup"
        :aria-label="label || name"
        :aria-describedby="ariaDescribedBy"
        :aria-required="required || undefined"
        :aria-invalid="!!error || undefined"
        @focusout="onGroupBlur"
      >
        <button
          v-for="(hex, idx) in PALETTE"
          :key="hex"
          :ref="(el) => (buttonRefs[idx] = el as HTMLButtonElement)"
          :id="idx === 0 ? inputId : undefined"
          type="button"
          :style="{ backgroundColor: hex }"
          :aria-label="hex"
          :aria-checked="model.value === hex"
          role="radio"
          :disabled="disabled"
          @click="pick(hex)"
          @keydown="onKeyDown($event, idx, hex)"
        />
      </div>
    </template>
  </AsFieldShell>
</template>
```

Wire it up via `:components` and tag the field:

```atscript
@meta.label 'Brand color'
@ui.form.component 'color-swatch'
brandColor: string
```

```vue
<AsForm
  :def="def"
  :form-data="formData"
  :types="types"
  :components="{ 'color-swatch': ColorSwatch }"
/>
```

## Accessibility checklist

- Bind `:id="inputId"` to the focusable element so `<label :for>` wired by
  `AsFieldShell` works.
- Bind `:aria-describedby="ariaDescribedBy"` to inherit the shell's
  description/error wiring.
- Set `:aria-required="required || undefined"` and
  `:aria-invalid="!!error || undefined"` on the inner control.
- For composite widgets (radiogroup, listbox, combobox), declare the right
  `role` on the container and label it with `:aria-label="label || name"`.
- Call `props.onBlur()` once when focus leaves the entire widget — see the
  `onGroupBlur` pattern above for multi-button widgets.

## When **not** to use a composable

Some built-in composables (`useAsArray`, `useAsNumber`, `useAsDecimal`) carry
specific assumptions: per-item recursion for arrays, a single text input with
locale-aware decimal parsing for `useAsNumber`. If your widget is a fundamentally
different shape — a tag input over `string[]` rendered as a single control, or
a stepper with `+`/`-` buttons over `number` — direct prop binding
(`props.model.value = ...`) stays cleaner. A `TagInput` or `NumberStepper`
typically follows that pattern.

## Next steps

- [Customization](/forms/customization) — wire your component into the form
- [Locale & currency](/forms/locale) — locale-aware composables
- [Validation](/forms/validation) — how the `error` prop gets populated
