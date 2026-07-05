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

## Bare root — skipping `AsFieldShell`

Presentational fields that don't want the standard label/error chrome — a
section header, a media block, a read-only summary — render their own root
instead of wrapping `AsFieldShell`. Bind `:class="props.class"` and
`:style="props.style"` on that outermost element:

```vue
<script setup lang="ts">
import type { TAsComponentProps } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps<number>>();
</script>

<template>
  <div :class="props.class" :style="props.style">
    <!-- your content -->
  </div>
</template>
```

`props.class` carries the field's grid placement — the default full-width span
**and** any `@ui.form.grid.colSpan` / `.rowSpan` override — together with
`@ui.form.classes`. Binding it is all you need: you never add `as-grid-item` or
`col-span-*` to the root yourself. Omit the binding and the field collapses to a
single implicit grid column.

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

const { model, error, onBlur, isDirty } = useAsField<string>({
  getValue: () => /* read your value */,
  setValue: (v) => /* write your value */,
  rules: [(v) => !!v || 'Required'],
  path: () => props.path,
  resetValue: '',
})
```

Returns `{ model, error, onBlur, isDirty }`. The composable registers with the
parent `<AsForm>` so the field participates in submit-time validation, reset,
and external-error wiring. `isDirty` is a reactive per-field
"changed-since-baseline" flag — `false` unless the form has `track-changes` on —
so a custom field can mark itself visually; see
[Change tracking — per-field dirty](/forms/change-tracking#marking-changed-fields-per-field-dirty).
See `packages/vue-form/src/composables/use-as-field.ts` for the full options
shape.

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

## Container renderers

A custom `@ui.form.component` on a **structured (object) field** replaces that
field's entire section chrome. Instead of the stock `AsObject` collapsible,
your component receives the object's `FormObjectFieldDef` (via `props.field`)
and lays its children out however you like — a tabbed shell, a side-nav, a
wizard, a two-column split — then re-renders the children yourself. The
children inherit the form's data binding, validation, path resolution, and
level-based section/island alternation, so they stay first-class fields.

A small kit of composables plus a few `AsIterator` props make this possible
without reaching into form internals. All are exported from
`@atscript/vue-form`:

| Primitive                                                                         | Role in a container renderer                                                                                                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`useAsVisibleFields`](#partitioning-children-useasvisiblefields)                 | Partition the child list, dropping statically- and dynamically-hidden children (`@ui.form.hidden` / `@ui.form.fn.hidden`) with AsField's exact semantics.     |
| [`useAsFieldScope`](#reading-custom-metadata-useasfieldscope)                     | Compute a child's absolute path and resolve custom `@ui.*` annotation pairs (static + `fn`) against its live scope — for tab icons, group keys, layout hints. |
| [`useAsOptionalField`](#optional-sections-useasoptionalfield)                     | Enable (instantiate defaults) or clear an optional object child, without mounting `<AsField>` for it.                                                         |
| [`useAsLevel`](#level-alternation) + [`provideAsNestedLevel`](#level-alternation) | Read / bump the section nesting level so your chrome slots back into the stock section/island alternation.                                                    |
| `AsIterator` `:def` / `:path-prefix` / `:fields` / `:levels`                      | Re-render a slice of children through the stock pipeline at the right path prefix and level.                                                                  |

Structural children you don't want to hand-layout — arrays, unions — are best
[delegated straight to `<AsField>`](#delegating-arrays-and-unions-to-asfield),
which carries their add/remove affordances and variant pickers for free.

### Worked example — a tabbed object shell

Tag an object whose direct children are themselves objects, and render one tab
per child section:

```atscript
@meta.label 'Account settings'
@ui.form.component 'tabbed'
settings: {
    @meta.label 'Profile'
    profile: {
        firstName: string
        lastName: string
    }

    @meta.label 'Billing'
    billing: {
        plan: string
        seats: number
    }
}
```

```vue
<!-- TabbedShell.vue -->
<script setup lang="ts">
import { computed, ref } from "vue";
import {
  AsIterator,
  useAsVisibleFields,
  useAsFieldScope,
  type TAsComponentProps,
} from "@atscript/vue-form";
import {
  isObjectField,
  META_LABEL,
  UI_FORM_FN_LABEL,
  type FormFieldDef,
  type FormObjectFieldDef,
} from "@atscript/ui";

const props = defineProps<TAsComponentProps>();

const objectDef = computed(() => (props.field as FormObjectFieldDef).objectDef);

// Drop hidden children (static + dynamic fn.hidden) with AsField's semantics.
const visible = useAsVisibleFields(() => objectDef.value.fields);

// One tab per nested-object child; leaf children render above the tabs.
const tabs = computed(() => visible.value.filter(isObjectField));
const leaves = computed(() => visible.value.filter((f) => !isObjectField(f)));

const { resolveProp } = useAsFieldScope();
function tabLabel(f: FormFieldDef): string {
  return resolveProp<string>(f, UI_FORM_FN_LABEL, META_LABEL) ?? f.name;
}

const active = ref(0);
</script>

<template>
  <div :class="props.class">
    <!-- Leaf fields rendered inline through the stock pipeline. -->
    <AsIterator v-if="leaves.length" :def="objectDef" :fields="leaves" />

    <nav role="tablist">
      <button
        v-for="(t, i) of tabs"
        :key="t.path"
        type="button"
        role="tab"
        :aria-selected="i === active"
        @click="active = i"
      >
        {{ tabLabel(t) }}
      </button>
    </nav>

    <!-- Active tab body: render that child object's fields directly, descending
         the path prefix into it and bumping one level so its own children
         alternate exactly as they would inside the stock section. -->
    <AsIterator
      v-if="tabs[active]"
      :def="(tabs[active] as FormObjectFieldDef).objectDef"
      :path-prefix="tabs[active].name"
      :levels="1"
    />
  </div>
</template>
```

Register it in `:components` and the object renders as tabs, each tab body a
live slice of the form:

```vue
<AsForm :def="def" :form-data="formData" :types="types" :components="{ tabbed: TabbedShell }" />
```

Because this is a **bare root** (no `AsFieldShell`), bind `:class="props.class"`
so the field's grid placement applies — see [Bare root](#bare-root-skipping-asfieldshell).

### Descending into children with `AsIterator`

`AsIterator` is the single primitive for re-rendering a `FormDef`'s fields
through the stock `AsField` pipeline. Four props control the slice:

- **`:def`** — the `FormDef` to iterate. For the object you replaced, that's
  `(props.field as FormObjectFieldDef).objectDef`; to descend into a child
  object, pass that child's `.objectDef`.
- **`:fields`** — an explicit field list overriding `def.fields`. Feed it a
  precomputed partition (the visible leaves, one tab's worth of children) so
  each field renders exactly once.
- **`:path-prefix`** — a dotted segment prepended to every child's path. When
  you pass a child object's `.objectDef` as `:def`, add `:path-prefix="child.name"`
  so the children resolve at their true absolute paths. Identity / non-reactive.
- **`:levels`** — bump the section nesting level for the rendered children
  (sugar over `provideAsNestedLevel`, below). Identity / non-reactive.

Paths and levels the container inherits automatically: `AsField` already
provides the replaced object's absolute path and its nesting level to your
component's subtree, so an `AsIterator` with no `:path-prefix` / `:levels`
re-renders the object's own direct children exactly as `AsObject` would.

### Level alternation

Structured sections alternate chrome by depth — odd levels render as
**sections**, even levels as **islands** (see
[Collapsible Sections](/forms/collapsible-sections)). `useAsLevel()` reads the
current level as a `ComputedRef<number>` (`-1` outside any structured field):

```typescript
import { useAsLevel } from "@atscript/vue-form";

const level = useAsLevel(); // ComputedRef<number>
```

When your chrome **stands in for** a structural level — you render a child
object's fields directly rather than letting that child render its own section
— the children would otherwise land one level too shallow and break the
alternation. Bump the level for that subtree with `provideAsNestedLevel(levels = 1)`,
or the equivalent `:levels` prop on `AsIterator`:

```typescript
import { provideAsNestedLevel } from "@atscript/vue-form";

provideAsNestedLevel(1); // children render at parent + 1
```

The bump is **relative** to the injected parent level, so the same renderer
stays correct at any depth — a tabbed shell nested three objects deep resumes
the alternation from wherever it sits. Pass the number of section levels your
chrome absorbs (usually `1`). In the tabbed example above, each tab body
absorbs the child object's own island, so `:levels="1"` keeps the grandchildren
one step further along the alternation, matching the stock rendering.

### Partitioning children — `useAsVisibleFields`

`useAsVisibleFields(fields)` returns a `ComputedRef<FormFieldDef[]>` with the
hidden children removed, applying AsField's exact hidden semantics: a static
`@ui.form.hidden` hides unconditionally; a dynamic `@ui.form.fn.hidden` is
resolved against the child's live fn scope. It subscribes to form data only
when some child actually carries a `fn.hidden` key, so a purely static field
list stays inert.

```typescript
import { useAsVisibleFields } from "@atscript/vue-form";

// `fields` is a MaybeRefOrGetter — pass a getter to stay reactive.
const visible = useAsVisibleFields(() => objectDef.value.fields);
```

Resolving `@ui.form.fn.hidden` (like any `fn` annotation) requires the dynamic
resolver — call `installDynamicResolver()` from `@atscript/ui-fns` once at app
startup. Without it, only the static `@ui.form.hidden` presence is honored.

### Reading custom metadata — `useAsFieldScope`

`useAsFieldScope()` returns plain (non-reactive) functions for working with a
child field's path and annotations. Wrap the calls in your own `computed` to
inherit reactivity over form data.

```typescript
import { useAsFieldScope } from "@atscript/vue-form";

const { absolutePath, scopeFor, resolveProp } = useAsFieldScope();
```

- **`absolutePath(field)`** — the child's absolute dotted path (current prefix
  joined with `field.path`).
- **`scopeFor(field, { withEntry? })`** — the fn scope `{ v, data, context }`
  with `v` read at the child's absolute path. `withEntry` layers the evaluated
  field `entry` on top (display-style fns take the entry-carrying scope,
  constraint fns take the bare one — mirrors AsField's dual-scope pattern).
- **`resolveProp<T>(field, fnKey?, staticKey?, opts?)`** — resolve a custom
  annotation pair, presence-gated like AsField: neither key present →
  `undefined` without touching reactive state; only the static key present →
  resolved against a shared inert scope; the `fn` key present → resolved
  against the full reactive scope. Use it to read a tab icon, a group key, or
  any bespoke `@ui.*` annotation you tag on children.

```typescript
// A custom `@ui.form.tab.icon` (static) / `@ui.form.fn.tab.icon` (dynamic) pair:
const icon = resolveProp<string>(child, "ui.form.fn.tab.icon", "ui.form.tab.icon");
```

`fn`-key resolution again requires `installDynamicResolver()` from
`@atscript/ui-fns`; the static key resolves with or without it.

### Optional sections — `useAsOptionalField`

For an optional object child, `useAsOptionalField(field)` gives you the same
enable/clear behavior `AsField` wires onto its optional toggle, usable from
your own chrome (a tab that lights up when its section is enabled, an "Add"
button on a side-nav item):

```typescript
import { useAsOptionalField } from "@atscript/vue-form";

const { optional, enabled, toggle } = useAsOptionalField(child);
// optional: boolean          — declared `optional?` in the type
// enabled:  ComputedRef<bool> — currently holds a value (`!= null`)
// toggle(on): void            — on → instantiate annotated defaults; off → clear to undefined
```

`toggle(true)` initializes the section with its `@meta.default` /
`@ui.form.fn.value` defaults and emits the blur-committed `update` change for
the field's absolute path; `toggle(false)` clears it to `undefined`. A
DB-roundtripped `null` counts as unset.

### Delegating arrays and unions to `<AsField>`

Objects are the natural thing to hand-layout, but array and union children
carry their own machinery — add/remove affordances honoring
`@expect.minLength` / `.maxLength`, per-item variant pickers, within-mount
variant stashes. Rather than reimplement that, render those children through
`<AsField>` and inherit all of it:

```vue
<template>
  <div v-for="child of visible" :key="child.path">
    <MyObjectPane v-if="isObjectField(child)" :field="child" />
    <!-- arrays, unions, leaves: let AsField pick the renderer and wire behavior -->
    <AsField v-else :field="child" />
  </div>
</template>
```

`<AsField>` reads the same provided path prefix and level, so a delegated child
lands at the correct absolute path and alternation depth with no extra props.

### Badges and expand/collapse

Two already-public composables round out a container renderer's chrome without
re-explaining here:

- [`useAsDescendantErrorCounts()`](/forms/nested-objects#reading-the-error-counts-yourself)
  — the `Map<absolutePath, errorCount>` behind collapsed-section error badges.
  Badge your tabs / nav items, or jump to the first errored section.
- [`useAsNestedSectionsStore()`](/forms/nested-objects#shared-sections-store) —
  the shared expand/collapse registry, so your chrome can drive (or read)
  open state alongside the form's stock sections.

## Next steps

- [Customization](/forms/customization) — wire your component into the form
- [Collapsible Sections](/forms/collapsible-sections) — own a section header
- [Nested Objects](/forms/nested-objects) — how the stock object chrome nests
- [Locale & currency](/forms/locale) — locale-aware composables
- [Validation](/forms/validation) — how the `error` prop gets populated
