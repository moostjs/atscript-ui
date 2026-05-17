The `as-*` shortcut tree, how to read it, and how to extend it without forking. All extensions go through `mergeVunorShortcuts` + `defineShortcuts`; the shortcut body is always a string of vunor primitives.

## Contents

- [Naming convention](#naming-convention)
- [Four shortcut groups](#four-shortcut-groups)
- [Group contents](#group-contents)
- [Reading a shortcut's body](#reading-a-shortcuts-body)
- [Composing from vunor primitives (recommended)](#composing-from-vunor-primitives-recommended)
- [Extending the shortcut tree](#extending-the-shortcut-tree)
- [Variant overrides](#variant-overrides)
- [Reka-UI state attributes](#reka-ui-state-attributes)
- [excludeComponents — drop unused classes](#excludecomponents--drop-unused-classes)
- [Component class maps](#component-class-maps)
- [createAsExtractor — when to call directly](#createasextractor--when-to-call-directly)

## Naming convention

| Pattern                | Meaning                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `as-<concept>`         | Base concept (e.g. `as-description`, `as-overlay`, `as-close-btn`, `as-field`, `as-table`, `as-form`)                      |
| `as-<case>-<concept>`  | Variant extending the base (e.g. `as-form-description` extends `as-description`, `as-dialog-close` extends `as-close-btn`) |
| `as-<concept>-<part>`  | A part of a composite concept (e.g. `as-form-title`, `as-fpill-chip`, `as-table-checkbox-tick`)                            |
| `as-<concept>-<state>` | A state variant (`as-fpill-active`, `as-fpill-label-active`, `as-table-row-active`)                                        |

The case-prefix pattern is the customization handle: overriding `as-form-description` restyles error/help text only inside forms; overriding `as-description` restyles it everywhere. Pick the narrowest extension point that fits the requirement.

## Four shortcut groups

`@atscript/ui-styles` exports four merged shortcut groups plus an `allShortcuts` super-merge.

```typescript
import {
  commonShortcuts, // shared base concepts
  formShortcuts, // <AsForm>, <AsField>, …
  tableShortcuts, // <AsTable>, <AsFilters>, …
  wfShortcuts, // <AsWfForm>
  allShortcuts, // merge of all four — pass to vunorShortcuts()
} from "@atscript/ui-styles";
```

Each is a `TVunorShortcut[]` (re-exported `TVunorShortcut` type from `vunor/theme`). `allShortcuts` is the standard entry point — only spread the individual groups when you intentionally want a subset (e.g. forms-only without table CSS in the bundle).

Source:

- `packages/ui-styles/src/shortcuts/index.ts` (lines 13-18) — `allShortcuts = mergeVunorShortcuts([commonShortcuts, formShortcuts, tableShortcuts, wfShortcuts])`.
- Each group is itself a merge of one-component-per-file shortcut definitions under `shortcuts/{common,form,table,wf}/`.

## Group contents

Representative top-level concepts per group. (Not exhaustive — read the directory for the full list.)

| Group             | Concepts (selected)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commonShortcuts` | `as-kbd`, `as-description`, `as-overlay`, `as-overlay-icon`, `as-close-btn`, `as-dialog-close`, `c8-progress` / `c8-progress-fill` / `c8-progress-label`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `formShortcuts`   | `as-form`, `as-form-title`, `as-form-description`, `as-form-error`, `as-form-overlay`, `as-form-grid`, `as-default-field`, `as-field-label`, `as-field-input-row`, `as-field-description`, `as-field-remove-btn`, `as-select-wrap`, `as-checkbox-field`, `as-radio-group`, `as-array`, `as-collapsible`, `as-object`, `as-ref`, `as-action`, `as-no-data`, `as-decimal-number`, `as-dropdown`                                                                                                                                                                                                                                                                    |
| `tableShortcuts`  | `as-table`, `as-th-*`, `as-td-*`, `as-table-scroll-container`, `as-table-outer-wrap`, `as-table-sticky`, `as-table-stretch`, `as-table-checkbox`, `as-table-row-active`, `as-table-empty`, `as-table-loading`, `as-table-error`, `as-table-query-overlay`, `as-cell-number`, `as-cell` (number/date/json/string/...), `as-fpill`, `as-page`, `as-column-menu`, `as-preset-picker`, `as-preset-dialog`, `as-filter-dialog`, `as-filter-field`, `as-config-dialog`, `as-config-tab`, `as-confirm-dialog`, `as-action-form`, `as-orderable-list`, `as-row-actions`, `as-sorter`, `as-table-actions`, `as-window-table`, `as-window-skeleton`, `as-window-scrollbar` |
| `wfShortcuts`     | `as-wf-form-error`, `as-wf-form-loading`, `as-wf-finish`, `as-wf-finish-message`, `as-wf-finish-actions`, `as-wf-finish-primary`, `as-wf-finish-option`, `as-wf-finish-skip` / `-fill` / `-label`, `as-wf-finish-countdown`                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Each group also re-exports its per-file slices (e.g. `asFormShortcuts`, `asFieldShortcuts`, `asTableShortcuts`, `asCellShortcuts`, …) so you can compose a subset preset by hand if needed. See `packages/ui-styles/src/shortcuts/{form,table}/index.ts` for the full export list.

## Reading a shortcut's body

Shortcuts live in `packages/ui-styles/src/shortcuts/{form,table,wf,common}/<as-name>.ts` as `defineShortcuts({...})` calls. Two body shapes:

```typescript
// Single-string body — class list applied unconditionally.
"as-description": "text-callout text-current/60 m-0",

// Object body — keyed by variant selector; "" is the base.
"as-close-btn": {
  "": "inline-grid place-items-center size-fingertip-s p-0 border-0 " +
      "bg-transparent text-current/80 cursor-pointer leading-none rounded-base " +
      "flex-shrink-0 transition-colors duration-120 text-[1.25em]",
  "hover:": "layer-2 text-current",
},
```

The object form's keys are UnoCSS variant prefixes. Common shapes used across the tree:

| Key                                               | Meaning                                                  |
| ------------------------------------------------- | -------------------------------------------------------- |
| `""`                                              | Base — unconditional classes                             |
| `"hover:"`                                        | `:hover` variant                                         |
| `"focus:"`, `"focus-within:"`, `"focus-visible:"` | Focus variants                                           |
| `"disabled:"`, `"hover:not-disabled:"`            | Disabled / not-disabled variants                         |
| `"[&_child]:"`                                    | Descendant selector variant (UnoCSS arbitrary variant)   |
| `"[&.classname]:"`                                | Compound-class variant (state via class on same element) |
| `"[&_:is(input,select,textarea)]:"`               | Multi-selector descendant — wrap list in `:is(...)`      |
| `"[&_tbody_tr:is([data-state=checked])]:"`        | Reka-UI state attribute via `:is()` (see below)          |

Example with a compound-class variant from `as-field.ts:12-13`:

```typescript
"[&.required_.as-field-label]:after:":
  'content-["_*"] scope-error text-current-hl font-700 ml-[0.1em]',
```

`<AsField>` adds class `required` on the wrapper when the field is required; the variant paints a red `*` after the label.

## `c8-progress` — progress-button primitive

A public 3-class family in `commonShortcuts` that turns any `c8-*`
clickable surface into a self-filling progress button — natural fit
for auto-fire skip buttons, hold-to-confirm, timed CTAs.

```html
<button
  class="c8-filled scope-primary c8-progress h-fingertip-m px-$m"
  :style="{ '--progress-duration': '4000ms' }"
>
  <span class="c8-progress-fill" />
  <span class="c8-progress-label">Confirm</span>
</button>
```

- `c8-progress` — composes on any `c8-*` base. Adds `relative overflow-hidden`.
- `c8-progress-fill` — absolutely positioned `bg-black/20` overlay,
  animates `width 0% → 100%` via `@keyframes progress-fill` over
  `--progress-duration`. CSS-only — no JS ticker needed.
- `c8-progress-label` — keeps the label in flow (required; otherwise
  the button collapses to its padding box).

The keyframes are registered as a UnoCSS preflight by `asPresetVunor`,
so consumers don't have to register anything beyond installing the
preset. Source: `packages/ui-styles/src/shortcuts/common/c8-progress.ts`.

## Composing from vunor primitives (recommended)

If you want your extension to inherit palette swaps, dark mode, and scope tinting from the rest of the `as-*` tree, compose its body from vunor primitives + plain UnoCSS utilities, and avoid hex/RGB color literals or pixel literals for color/spacing/typography. If you don't need that — hardcode whatever you like; the shortcut still works.

Vunor vocabulary you can lean on:

| Bucket              | Tokens                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Spacing             | `$xxs`, `$xs`, `$s`, `$m`, `$l`, `$xl`, `$xxl`                                                                               |
| Fingertip           | `fingertip-xs..xl` (`h-`, `w-`, `size-`)                                                                                     |
| Typography          | `text-body`, `text-callout`, `text-body-l`                                                                                   |
| Scope               | `scope-primary`, `scope-error`, `scope-good`, `scope-warn`, `scope-neutral`, `scope-secondary`                               |
| Current helpers     | `current-hl`, `current-border-hl`, `current-outline-hl`, `text-current`, `text-current-hl`, `bg-current-hl/{10,15,20,30,40}` |
| Layers              | `layer-0`, `layer-1`, `layer-2`                                                                                              |
| Surfaces            | `surface-50`, `surface-100`, `surface-600`, ...                                                                              |
| Button chrome       | `c8-filled`, `c8-flat`, `c8-outlined`, `c8-light`, `c8-chrome`                                                               |
| Icon helpers        | `i8-bare`, `i8-apply-border`, `i8-apply-outline`                                                                             |
| Radius              | `rounded-base`, `rounded-r0..r4`, `rounded-full`                                                                             |
| Shadow              | `shadow-popup`                                                                                                               |
| Borders             | `border-1` alone pulls color from the active surface/layer                                                                   |
| Focus ring          | `outline i8-apply-outline current-outline-hl` (composed)                                                                     |
| Disabled affordance | `disabled-soft` (vunor primitive)                                                                                            |
| Em-sized icons      | `text-[1em]`, `text-[1.25em]`, `text-[3em]` (size relative to text)                                                          |

For layout values that vunor doesn't tokenize (e.g. `min-w-[8em]`, `w-[4em]`, `min-h-[80px]`), explicit literals are expected — vunor only owns palette/spacing/typography/depth.

If you want palette + dark-mode tracking, the literals to swap for tokenized forms are:

- Hex / RGB / HSL color literals (`#ef4444`, `rgb(...)`, `bg-red-500`) — replace with a scope token (`scope-error`, `c8-filled`, `current-hl`, …).
- Pixel literals for spacing (`gap-[8px]`, `p-[12px]`) — replace with `$xxs..$xxl`.
- Custom box shadows or focus rings — `shadow-popup`, `current-outline-hl outline i8-apply-outline`.
- Hardcoded border color (`border-grey-200`) — `border-1` alone picks up the active surface/layer color.

Those keep your shortcut tracking the same palette / dark-mode / scope system as the bundled ones. Skipping them is a choice, not an error.

## Extending the shortcut tree

The standard extension path is `mergeVunorShortcuts(allShortcuts, defineShortcuts({...}))`. Add a NEW `as-*` shortcut for a new concept; extend an EXISTING one's variant map when you're painting over its state.

```typescript
import { defineConfig } from "unocss";
import {
  asPresetVunor,
  allShortcuts,
  defineShortcuts,
  mergeVunorShortcuts,
} from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

const consumerShortcuts = defineShortcuts({
  // New concept — picks up palette/scope automatically.
  "as-brand-banner": "scope-primary c8-light px-$m py-$s rounded-base font-600 text-callout",
  // Extension of an existing one (variant naming convention):
  "as-form-banner": "as-brand-banner mb-$m",
});

export default defineConfig({
  presets: asPresetVunor({
    /* ... */
  }),
  shortcuts: [vunorShortcuts(mergeVunorShortcuts([allShortcuts, consumerShortcuts]))],
});
```

`defineShortcuts` and `mergeVunorShortcuts` are re-exported from `vunor/theme` via `@atscript/ui-styles` (see `packages/ui-styles/src/index.ts:18-19`) — one import covers preset, allShortcuts, and authoring helpers.

## Variant overrides

To paint over an existing shortcut's state without replacing its base, target a variant key when defining your own slice. Example — change the focus ring on `as-fpill` from the bundled scope-primary to a `scope-good`:

```typescript
defineShortcuts({
  // Re-declare ONLY the variant you want to override. `mergeVunorShortcuts`
  // merges keys, so `as-fpill`'s base + `hover:` stay intact and your
  // `focus-within:` wins.
  "as-fpill": {
    "focus-within:": "!scope-good current-border-hl outline i8-apply-outline",
  },
});
```

Mergers are shallow on the outer key + deep on the variant map — overriding `as-fpill.focus-within:` doesn't touch `as-fpill.""` or `as-fpill.hover:`. Mirror the existing variant syntax exactly (trailing colon for variants, empty string for base).

## Reka-UI state attributes

Reka-UI primitives expose keyboard/selection state on DOM attributes, not classes:

| Attribute              | Meaning                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `data-highlighted=""`  | Keyboard cursor / pointer focus on a menu item, listbox row |
| `data-state="checked"` | Selected / on (combobox item, checkbox, switch)             |
| `data-state="open"`    | Open trigger / popover                                      |
| `aria-selected="true"` | Selected (used on rows that aren't combobox items)          |

When extending shortcuts that target Reka-UI primitives, wrap the inner attribute selector in `:is(...)`. **Nested `[]` inside an arbitrary-variant bracket silently fails to compile in UnoCSS.**

```typescript
// BAD — nested [...] inside [...] does NOT compile
"[&_tbody_tr[data-state=checked]]:": "bg-current-hl/15",

// GOOD — wrap inner attribute selector in :is()
"[&_tbody_tr:is([data-state=checked])]:": "bg-current-hl/15",
```

See the canonical pattern in `packages/ui-styles/src/shortcuts/table/as-table.ts:28-34`:

```typescript
"[&_tbody_tr:is([data-highlighted=''])]:": "layer-1",
"[&_tbody_tr:is(.as-table-row-active)]:": "layer-1",
"[&_tbody_tr:is([data-state=checked])]:": "bg-current-hl/15",
"[&_tbody_tr:is([aria-selected=true])]:": "bg-current-hl/15",
"[&_tbody_tr:is([data-highlighted='']):is([data-state=checked])]:": "bg-current-hl/30",
```

Two `:is()` chained gives you compound state (highlighted AND checked).

## excludeComponents — drop unused classes

If a consumer has replaced a default Tier-2 component with their own implementation, the safelist for that component's classes is dead weight. Pass kebab names to `excludeComponents` to drop them:

```typescript
asPresetVunor({
  excludeComponents: ["as-input", "as-select", "as-cell-json"],
});
```

Classes for excluded components are still REGISTERED in the shortcut tree (so they don't error if referenced) — but the extractor stops emitting them onto the safelist, so they're tree-shaken out of the generated CSS. See `packages/ui-styles/src/extractor.ts:14-15,42-43`.

This is post-match: the extractor still walks your source, but emitted matches for excluded components are dropped. Use it only after you've fully replaced the component — leaving a partial replacement on the safelist results in styles that won't paint.

## Component class maps

Generated at the package's publish time; you read them, you don't compute them. Useful for custom build pipelines (e.g. generating a static `class="..."` allowlist for a non-UnoCSS pipeline that still ships `@atscript/vue-*`).

```typescript
import {
  componentClasses, // Record<kebab, readonly string[]>
  componentPackages, // Record<kebab, "form" | "table" | "wf">
  helperAliases, // Record<helperFnName, readonly kebab[]>
  getComponentClasses, // (...names: string[]) => string[]
  getHelperClasses, // (...helpers: string[]) => string[]
} from "@atscript/ui-styles";

// All classes painted by <AsForm> + <AsField> + <AsIterator>:
const formClasses = getComponentClasses("as-form", "as-field", "as-iterator");

// Classes pulled in when a source file calls `createDefaultTypes()`:
const helperClasses = getHelperClasses("createDefaultTypes");
```

These maps are generated at the package's publish time and shipped as part of the build — read them, don't try to mutate them at runtime.

## createAsExtractor — when to call directly

Usually you don't. `asPresetVunor()` already registers `createAsExtractor({ excludeComponents })` as one of its preset entries (`src/preset.ts:240-244`). Reach for `createAsExtractor` directly only when you're building a custom UnoCSS config that does NOT use `asPresetVunor()` and you still want safelist seeding from `@atscript/vue-*` source files:

```typescript
import { defineConfig } from "unocss";
import { createAsExtractor } from "@atscript/ui-styles";

export default defineConfig({
  presets: [
    /* your own vunor preset assembly, NOT asPresetVunor */
  ],
  extractors: [createAsExtractor({ excludeComponents: ["as-input"] })],
});
```

The extractor walks code for:

1. Subpath imports — `from "@atscript/vue-form/as-form"` etc.
2. Named imports from the package barrel — `import { AsForm, AsField } from "@atscript/vue-form"`.
3. Tag names in templates — `<AsForm>`, `<as-form>`, `<AsField>` etc.
4. Helper function calls — e.g. `createDefaultTypes()`, mapped via `helperAliases`.

See `packages/ui-styles/src/extractor.ts:49-70`. The cheap short-circuit at line 32-39 skips files containing none of `@atscript/`, `<As`, `<as-`, or a known helper name.
