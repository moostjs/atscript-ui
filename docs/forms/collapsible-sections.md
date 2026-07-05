---
outline: deep
---

# Collapsible Sections

Use `<AsCollapsible>` directly to give your own custom component the same
section chrome `AsObject` renders nested objects with — plus header-row
actions `AsObject` can't expose. A custom `@ui.form.component` only renders
_inside_ a section body, so it can never reach the header. Tag
`AsCollapsible` yourself and you own the title row: badges, sub-text, and
action buttons aligned with the heading.

## The smallest example

A custom "Active sessions" component that owns its own section header and
hangs a "Log out all others" button off the title row. It receives the
standard [`TAsComponentProps`](/forms/custom-components#the-contract), so
`path` and `level` thread in from the resolved field.

```vue
<!-- SessionsSection.vue -->
<script setup lang="ts">
import { AsCollapsible, type TAsComponentProps } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps<unknown[]>>();

function logoutOthers(): void {
  /* call your API */
}
</script>

<template>
  <AsCollapsible
    :level="props.level ?? 1"
    :path="props.path"
    :class="props.class"
    title="Active sessions"
    description="Devices currently signed in to your account"
  >
    <template #actions>
      <button type="button" @click="logoutOthers">Log out all others</button>
    </template>
    <template #body>
      <ul>
        <li v-for="s of props.model.value" :key="(s as any).id">
          {{ (s as any).device }}
        </li>
      </ul>
    </template>
  </AsCollapsible>
</template>
```

Register it in the components map and tag the field:

```atscript
@meta.label 'Active sessions'
@ui.form.component 'sessions-section'
sessions: {
    id: string
    device: string
}[]
```

```vue
<AsForm
  :def="def"
  :form-data="formData"
  :types="types"
  :components="{ 'sessions-section': SessionsSection }"
/>
```

The section renders with the standard chrome — clickable summary, chevron,
expand/collapse — and the "Log out all others" button sits on the title row.

## When to reach for it vs `AsObject`

- **`AsObject`** — the default. It already wraps every nested object in
  `AsCollapsible` and recurses into the children automatically. If you only
  need stock section chrome around a nested object, do nothing; you get it
  for free. See [Nested Objects](/forms/nested-objects).
- **`AsCollapsible`** — reach for it when you need that chrome around a
  _custom_ component, or when you need **header-row actions** (sessions,
  roles, devices, API keys…) that `AsObject` doesn't expose.

## Props

Full signatures live in the [API reference](/api/vue-form#ascollapsible).
The fields you'll set most:

| Prop              | Meaning                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `level`           | **Required.** Selects chrome + nesting depth (see table below).                                                           |
| `path`            | Unique key registered with the sections store for expand/collapse + error-driven auto-open. Must be unique (see gotchas). |
| `title`           | Header heading text.                                                                                                      |
| `description`     | Sub-text under the title.                                                                                                 |
| `error`           | Renders an alert row at the top of the body.                                                                              |
| `defaultOpen`     | Open on first mount. Defaults to `false`.                                                                                 |
| `hidden`          | Hides via `v-show` — the section stays mounted and registered.                                                            |
| `arrayIndex`      | Appends a `#N` suffix to the title.                                                                                       |
| `optional`        | When `true` and not enabled, the `empty` slot renders instead of the section.                                             |
| `optionalEnabled` | Gates the `empty` slot — the placeholder shows when `optional && !optionalEnabled`.                                       |

`level` drives both the visual variant and the heading tag:

| `level`           | Variant     | Chrome                                                               |
| ----------------- | ----------- | -------------------------------------------------------------------- |
| `≤ 0`             | **root**    | No chrome — renders the body only.                                   |
| `1, 3, 5…` (odd)  | **section** | Clickable `<summary>`, top divider, `<h3>` at level ≤ 1 else `<h4>`. |
| `2, 4, 6…` (even) | **island**  | Padded card with an even/odd background layer alternating by depth.  |

For a standalone top-level section, pass `level: 1`. If instead you're building
a container renderer that mounts a structured field's children itself (a tabbed
shell, side-nav), don't hardcode a level — read and bump it relative to the
parent with [`useAsLevel` / `provideAsNestedLevel`](/forms/custom-components#level-alternation)
(or `AsIterator`'s `:levels` prop) so the alternation stays correct at any depth.

## Slots

Every header slot renders **inside `<summary>`**.

| Slot           | Renders                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------- |
| `title-extras` | Inline, right after the title text.                                                         |
| `badges`       | After the title row.                                                                        |
| `actions`      | Header action buttons. ⚠ Always visible, **even when collapsed** (it lives in `<summary>`). |
| `body`         | The section content.                                                                        |
| `empty`        | The "enable this section" placeholder, shown when `optional && !optionalEnabled`.           |

## Header actions only when expanded

Because `actions` renders in `<summary>`, it shows whether the section is
open or closed. For an action that should appear only when the section is
expanded, either put it in `body`, or gate it on the store's open state:

```vue
<script setup lang="ts">
import { AsCollapsible, useAsNestedSectionsStore } from "@atscript/vue-form";

const props = defineProps<{ path: string }>();
const sections = useAsNestedSectionsStore();
</script>

<template>
  <AsCollapsible :level="1" :path="props.path" title="Active sessions">
    <template #actions>
      <button v-if="sections?.isOpen(props.path)" type="button">Log out all others</button>
    </template>
    <template #body><!-- … --></template>
  </AsCollapsible>
</template>
```

## Participating in expand/collapse & auto-open

On mount (when `level` is non-root and `path` is set), `AsCollapsible`
registers its `path` with the shared sections store, so it joins the form's
**Expand all / Collapse all** and **error-driven auto-open**, and shows a
descendant-error-count badge when collapsed. This works as long as an
[`<AsForm>`](/api/vue-form#asform) ancestor — or an explicit
[`provideAsNestedSectionsStore()`](/forms/nested-objects#shared-sections-store)
— supplies the store. Those mechanics are owned by
[Nested Objects](/forms/nested-objects#error-aware-auto-open); this page
only consumes them.

## Full-bleed dividers in a padded card

A **section** (odd `level`) draws only top/bottom dividers, so it inlines into
the surrounding form. By default those dividers stop at the padded content box
of whatever wraps the section. Set the inherited `--as-inset` CSS variable to
the wrapper's horizontal padding and the dividers full-bleed to its edges,
while the section's own title and fields stay aligned inside the padding.

**Nested inside an island — automatic.** Each **island** (even `level`)
declares `--as-inset` equal to its own padding, so a section nested in it
bleeds its dividers to the island's inner edges with no extra work.

**A whole form inside your own card — opt in.** Set `--as-inset` on the card
to match its horizontal padding:

```vue
<div class="layer-0 border-1 rounded-r2 p-$m [--as-inset:1em]">
  <AsForm :def="def" :form-data="formData" :types="types" />
</div>
```

`p-$m` is `1em`, so `[--as-inset:1em]` matches it. Top-level section dividers
now span the card's edges; plain fields and nested islands stay inside the
padding. For a different padding token, set `--as-inset` to that value (e.g.
`[--as-inset:var(--card-spacing)]` with Vunor's `card`). When `--as-inset` is
unset it resolves to `0px`, so nothing changes — the feature is opt-in, and
only the **section** variant bleeds; the **island** keeps its full border.

## DOs and DON'Ts

- **DO pick a unique `path`.** The store keys open-state by `path`. A `path`
  that collides with a real form-field path shares that field's open-state.
  For standalone use, choose a stable key that won't clash with any dotted
  field path in your form.
- **DON'T expect `actions` to hide when collapsed.** It renders in
  `<summary>`, so it's always visible. Use `body` or the
  `useAsNestedSectionsStore().isOpen(path)` gate above for expanded-only
  actions.
- **DO bind `:class="props.class"` yourself** when used as a custom
  `@ui.form.component`. `AsCollapsible` is a **bare root** — it has no
  `AsFieldShell` — so it does **not** auto-apply the field's grid
  placement. The bare-root rule is covered in
  [Custom Components](/forms/custom-components).
- **DO match `--as-inset` to the wrapper's horizontal padding** when you wrap
  a form for full-bleed dividers. Larger than the padding overflows the card;
  smaller leaves the divider short. The value is `em`-based, so keep the card
  and form at the same font size.

## See also

- [Nested Objects](/forms/nested-objects) — the automatic `AsObject` chrome
  and the shared sections store.
- [Custom Components](/forms/custom-components) — the `TAsComponentProps`
  contract and the bare-root class rule.
- [API reference](/api/vue-form#ascollapsible) — full prop and slot
  signatures.
