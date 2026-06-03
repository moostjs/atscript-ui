# collapsible-sections

Use `AsCollapsible` directly to give a custom display component its own section chrome (title, description, badges) and **header-row actions** — the part a `@ui.form.component` can't reach because it only renders inside the body. Reusable for any "list section with a header action" (e.g. a "Sessions" section with a "Log out all others" button).

## Quick start

A custom component that owns its section chrome via `<AsCollapsible :level="1">`, with a header action and a body, wired through `@ui.form.component`:

```atscript
@ui.form.component 'sessions'
sessions: Session[]
```

```vue
<script setup lang="ts">
import { AsCollapsible } from "@atscript/vue-form";
import type { TAsComponentProps } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps>();
function logoutOthers() {
  /* ... */
}
</script>

<template>
  <AsCollapsible
    :level="1"
    :path="props.path"
    :title="props.label"
    :description="props.description"
    :class="props.class"
  >
    <template #actions>
      <button @click="logoutOthers">Log out all others</button>
    </template>
    <template #body>
      <!-- render the list -->
    </template>
  </AsCollapsible>
</template>
```

Register a component name via `:components="{ sessions: MySessions }"` (see [customization.md](customization.md)).

## Invariants

| #   | Rule                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **`actions` / `badges` / `title-extras` render inside `<summary>` → ALWAYS visible, even when collapsed.** For header content that should appear only when open, put it in `#body`, or gate on `useAsNestedSectionsStore()?.isOpen(path)`.                   |
| 2   | **`path` must be UNIQUE.** Colliding with a real field path shares open-state. For standalone use, pick a stable non-field key.                                                                                                                              |
| 3   | **Store registration needs an `<AsForm>` ancestor or an explicit `provideAsNestedSectionsStore()`.** Without a store, open-state falls back to closed and Expand-all / Collapse-all won't reach it. Mechanics: [structural-fields.md](structural-fields.md). |
| 4   | **`level` selects chrome:** ≤0 → root (body only, no header), odd → section (clickable `<summary>`), even ≥2 → island (padded card). Pass `level:1` for a standalone top-level section.                                                                      |
| 5   | **As a custom `@ui.form.component`, `AsCollapsible` is a bare root** (no `AsFieldShell`) → bind `:class="props.class"` for grid placement. Bare-root rule: [customization.md](customization.md).                                                             |
| 6   | **`empty` slot shows only when `optional && !optionalEnabled`.**                                                                                                                                                                                             |

## Slots

All header slots (`title-extras`, `badges`, `actions`) render inside `<summary>` — see invariant 1. Content slots: `body`, `empty`. Shapes: `TAsCollapsibleSlots`.

## Expose

`runAndFocus` / `runAndFocusNew` — open-then-focus helpers (template ref on `<AsCollapsible>`).

## Key imports

```ts
import { AsCollapsible } from "@atscript/vue-form";
// or subpath: import AsCollapsible from "@atscript/vue-form/as-collapsible";
import type { TAsCollapsibleProps, TAsCollapsibleSlots } from "@atscript/vue-form";

// Sections store (open/closed registry):
import { useAsNestedSectionsStore, provideAsNestedSectionsStore } from "@atscript/vue-form";
```

## References

| Domain                         | File                                         | When                                                                                                                         |
| ------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Sections store + nested chrome | [structural-fields.md](structural-fields.md) | Store mechanics (`register`/`toggle`/`isOpen`/`expandAll`), how `AsObject`/`AsArray` wrap nested structures, error auto-open |
| Bare-root class rule + wiring  | [customization.md](customization.md)         | Why a bare root must bind `:class="props.class"`, `@ui.form.component` + `:components` wiring, `TAsComponentProps`           |

## See also

Reference docs: https://ui.atscript.dev/forms/collapsible-sections. Source: `packages/vue-form/src/components/as-collapsible.vue`.
