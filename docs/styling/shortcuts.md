# The as-\* Shortcut System

Every visual rule in `@atscript/vue-form`, `@atscript/vue-table`, and `@atscript/vue-wf` lives in a single shortcut tree under [`packages/ui-styles/src/shortcuts/`](https://github.com/moostjs/atscript-ui/tree/main/packages/ui-styles/src/shortcuts). Components emit `as-*` class names; the shortcuts turn those into vunor-primitive compositions. Once you know the tree, theming and per-state tweaks happen in one place instead of scattered across your stylesheet.

## Naming convention

Two rules cover the entire tree:

1. **`as-<concept>`** is the base shortcut. Single source of truth for that concept's visual signature.
2. **`as-<case>-<concept>`** is a case-specific variant that extends the base.

For example, descriptive helper text:

```typescript
// shortcuts/common/index.ts
"as-description": "text-callout text-current/60 m-0",
```

```typescript
// shortcuts/form/as-field.ts
"as-field-description": "as-description -mt-[0.2em]",
```

```typescript
// shortcuts/form/as-form.ts
"as-form-description": "as-description",
```

Consumers can repaint every description in the UI by overriding `as-description` alone — and every variant inherits the change. Same idea for `as-overlay` / `as-form-overlay` / `as-table-query-overlay`, `as-close-btn` / `as-dialog-close`, `as-cell-*` row in tables.

## Shortcut groups

Shortcuts are split into four logical groups. They merge into `allShortcuts` (what `asPresetVunor` registers by default), but you can mount them individually if you only use one package.

| Export             | What it covers                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `commonShortcuts`  | Cross-package primitives: `as-description`, `as-overlay`, `as-kbd`, `as-close-btn`, `as-dialog-close`.         |
| `formShortcuts`    | Form chrome: `as-form*`, `as-field*`, `as-default-field`, `as-checkbox-radio*`, `as-array*`, `as-object*`, `as-collapsible*`, `as-decimal-number*`, `as-dropdown*`, `as-ref*`, `as-action*`, `as-no-data*`, `as-form-grid*`. |
| `tableShortcuts`   | Table chrome: `as-table*`, `as-cell-*`, `as-column-menu*`, `as-filter-dialog*`, `as-config-dialog*`, `as-filter-field*`, `as-fpill*`, `as-orderable-list*`, `as-preset-picker*`, `as-window-table*`, `as-window-skeleton*`, `as-row-actions*`, `as-sorter*`, `as-page*`, `as-confirm-dialog*`. |
| `wfShortcuts`      | Workflow form chrome: `as-wf-form*`.                                                                           |

Import them directly when you only need one:

```typescript
import { defineConfig } from "unocss";
import { commonShortcuts, formShortcuts, asPresetVunor } from "@atscript/ui-styles";
import { mergeVunorShortcuts, vunorShortcuts } from "vunor/theme";

export default defineConfig({
  presets: asPresetVunor(),
  shortcuts: [vunorShortcuts(mergeVunorShortcuts([commonShortcuts, formShortcuts]))],
});
```

Mostly you'll just use `allShortcuts`.

## Extending the tree

`mergeVunorShortcuts` accepts an array of shortcut objects and folds them into a single merged map — later entries can extend earlier ones with hover / focus / nested selectors. The standard recipe:

```typescript
import {
  allShortcuts,
  asPresetVunor,
  defineShortcuts,
  mergeVunorShortcuts,
} from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

const appShortcuts = defineShortcuts({
  // New concept — sibling of the existing `as-*` tree
  "as-foo-extra":
    "scope-primary border-1 layer-0 px-$m py-$s rounded-r2 text-body",

  // Existing concept — paint over a state without forking the body
  "as-form": {
    "[&_.as-field-label]:": "uppercase tracking-wide",
  },
});

export default defineConfig({
  presets: asPresetVunor(),
  shortcuts: [
    vunorShortcuts(mergeVunorShortcuts([allShortcuts, appShortcuts])),
  ],
});
```

Two patterns and when to reach for each:

- **Add a sibling shortcut** when introducing a new piece of UI. Pick a name that fits the `as-<case>-<concept>` convention if it extends an existing concept, or `as-<new-concept>` if it stands alone.
- **Extend an existing shortcut's variant map** when painting over a state (`hover:`, `focus-within:`, `[&_child]:`, `[&.error]:`). Copying the whole body and tweaking it works, but it fragments the source of truth — future palette / dark-mode updates to the original won't reach your fork.

`mergeVunorShortcuts` is associative, so `[allShortcuts, appShortcuts]` and `[appShortcuts, allShortcuts]` produce different results. Order matters: **put your overrides last** so they win.

## Composing with vunor primitives

When you add a new `as-*` shortcut and want it to inherit palette, dark mode, and scope tinting, compose its body from vunor primitives instead of pixel literals or hex colors. The library's own shortcut tree follows the same approach — that's what lets a single `palette.colors.primary` change in `presetVunor()` repaint everything downstream. If you'd rather hardcode values in a particular shortcut, that's fine too; just know that shortcut won't follow palette changes.

| Intent                                      | vunor primitive                                                     | Hardcoded equivalent                                   |
| ------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| Gap / padding / margin                      | spacing tokens `$xxs..$xxl`                                         | `gap-[8px]`, `px-[12px]`                               |
| Control heights / touch targets             | `h-fingertip-xs/s/m/l/xl`                                           | `h-[32px]`                                             |
| Body / secondary / title text               | `text-body`, `text-callout`, `text-body-l`                          | `text-[length:13px]`                                   |
| Icon-glyph sizing                           | em-based `text-[1em]`, `text-[1.25em]`                              | `w-[16px] h-[16px]`                                    |
| Elevated surfaces                           | `shadow-popup`, `popup-card`                                        | custom box-shadow                                      |
| Borders (default)                           | `border-1` alone — color comes from active surface/layer            | `border-grey-200 dark:border-grey-800`                 |
| Focus rings                                 | `current-outline-hl outline i8-apply-outline`                       | `[box-shadow:0_0_0_3px_...]`                           |
| Button / clickable surfaces                 | `c8-filled / c8-flat / c8-outlined / c8-light / c8-chrome`          | custom hover/active rules                              |
| Inputs (bordered)                           | `border-1 layer-0 current-outline-hl` + `i8-apply-outline` on focus | `i8-input i8-apply-border` (leaks scope color as fill) |

The benefit of routing through these primitives is that a single `palette.colors.primary` change in `presetVunor()` repaints everything downstream. Pick whichever side of the table fits the level of theme-awareness you want for that particular shortcut.

## Example shortcut bodies

A few real entries from the source so the patterns are concrete.

### Form error banner

```typescript
// shortcuts/form/as-form.ts
"as-form-error":
  "scope-error surface-50 border-1 rounded-r2 px-$m py-$s mb-$s text-callout text-current-hl flex items-center gap-$s",
```

- `scope-error` activates the error palette branch — every `current-*` / `surface-*` / `border-*` resolves through error scope.
- `surface-50` paints the banner background in a tinted scope variant.
- `border-1` alone — vunor pulls the border color from the active surface.
- `text-current-hl` uses the highlighted variant of the active text color (error red).

### Table number cell

```typescript
// shortcuts/table/as-cell.ts
"as-cell-decimal": "text-right tabular-nums font-mono",
```

A minimal shortcut. Right-alignment plus tabular-numerals so numbers in a column align by decimal. No color, no spacing — those come from the row's parent `as-window-table` chrome.

### Close button with state map

```typescript
// shortcuts/common/index.ts
"as-close-btn": {
  "":
    "inline-grid place-items-center size-fingertip-s p-0 border-0 " +
    "bg-transparent text-current/80 cursor-pointer leading-none rounded-base " +
    "flex-shrink-0 transition-colors duration-120 text-[1.25em]",
  "hover:": "layer-2 text-current",
},
"as-dialog-close": "as-close-btn ml-auto",
```

The object-form syntax lets a shortcut declare its base body under `""` and then add variant bodies (`"hover:"`, `"focus-visible:"`, `"[&_.icon]:"`). Consumers paint over a single state without forking the body.

### Default form field, deep selectors

```typescript
// shortcuts/form/as-field.ts
"as-default-field": {
  "": "as-grid-item flex flex-col gap-$xs relative",
  "[&_label]:": "font-600",
  "[&.required_.as-field-label]:after:":
    'content-["_*"] scope-error text-current-hl font-700 ml-[0.1em]',
  "[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:": inputBase,
  "[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea):focus]:":
    "current-border-hl outline i8-apply-outline",
  "[&.error_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:":
    "scope-error current-border-hl border-current",
},
```

This is what makes form fields styleable through one shortcut. The base body lays out the field; the variant map styles every input element inside it (`:is(input, select, textarea)`) with consistent focus and error states. To restyle every input in your forms uniformly, override the relevant variant key in your merged shortcuts — that's typically less work than passing `:class` per-field.

::: warning Comma-separated arbitrary variants
Comma-separated selector lists silently break the `dark:` qualifier — UnoCSS only prefixes `.dark ` onto the first selector. Wrap the inner list in `:is(...)` so the variant resolves to a single selector and theme-aware rules apply uniformly.

Same pitfall with nested attribute selectors: `[&_tr[data-state=checked]]:` silently fails. Wrap the inner attribute selector in `:is(...)`:

```typescript
"[&_tbody_tr:is([data-state=checked])]:": "scope-primary bg-current-hl/15",
```

:::

## Class extractor & safelisting

Two pieces handle "which `as-*` classes ship in the consumer's CSS":

- **`componentClasses`** — pre-computed `Record<kebab-name, string[]>` mapping each component (e.g. `as-form`, `as-filter-dialog`) to every class its template emits. Generated at our build time from the source.
- **`helperAliases`** — pre-computed `Record<helperName, kebab-name[]>` for the default-bundle helpers (`createDefaultTypes`, `createDefaultControls`, `createDefaultCellTypes`). A call to `createDefaultControls()` in your code pulls in classes for every default it wires up.

The custom extractor that `asPresetVunor()` registers walks your source for three signals:

1. Subpath imports — `from "@atscript/vue-form/as-input"`.
2. Barrel imports — `import { AsInput } from "@atscript/vue-form"`.
3. Tags — `<AsInput>`, `<as-input>`.
4. Helper calls — `createDefaultControls()`, `createDefaultTypes()`.

For each match it adds the corresponding kebab name to the safelist and pulls in `componentClasses[name]`. You don't have to safelist anything manually unless you reference a class via a string that the extractor can't see (e.g. `@ui.form.prefix.icon: 'i-as-star'` in a `.as` file).

For full manual control:

```typescript
import { getComponentClasses, getHelperClasses, asPresetVunor } from "@atscript/ui-styles";

export default defineConfig({
  presets: asPresetVunor({}),
  safelist: [
    ...getComponentClasses("as-form", "as-input", "as-select"),
    ...getHelperClasses("createDefaultTypes"),
  ],
});
```

`getComponentClasses(...kebabNames)` returns a deduped class array for the named components. `getHelperClasses(...helperNames)` does the same for the helper aliases.

### Excluding defaults you swapped out

If you replaced one of our default components with your own, the default's classes still ship by default — the extractor sees `createDefaultControls(` in your source and assumes you want the whole bundle. Drop them with `excludeComponents`:

```typescript
asPresetVunor({
  excludeComponents: ["as-filter-dialog", "as-config-dialog"],
});
```

After this, your custom `MyFilterDialog` renders normally, but the unused `as-filter-dialog-*` styles never make it into the bundle.

## Next steps

- [Pre-built CSS](/styling/prebuilt-css) — opt out of UnoCSS entirely (loses dynamic theming).
- [Theme & Palette](/styling/theme) — change colors and radius so the tree restyles itself.
