Customize the bundled icon set. Two public extension points: `iconOverrides` for replacing existing aliases, and your own `presetIcons` collection (under a different prefix) for adding new icons.

## Contents

- [Default icon set](#default-icon-set)
- [Reading the icon map programmatically](#reading-the-icon-map-programmatically)
- [Overriding an icon — iconOverrides](#overriding-an-icon--iconoverrides)
- [Unknown keys ignored](#unknown-keys-ignored)
- [Adding brand-new icons](#adding-brand-new-icons)
- [Em-based sizing rule](#em-based-sizing-rule)
- [Reference grep — i-as-\* usage in shortcuts](#reference-grep--i-as--usage-in-shortcuts)

## Default icon set

Out-of-the-box icons live under the `as` collection — every glyph the library paints is `i-as-<name>`. Categories shipped:

| Category          | Aliases                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Dialog / chrome   | `close`, `menu`, `ellipsis`, `settings`                                                  |
| Table operations  | `filter`, `filter-ops`, `sort-asc`, `sorters`, `columns`, `refresh`                      |
| Field markers     | `field-empty`, `field-fill`, `value-help`                                                |
| Search            | `search`                                                                                 |
| Inline controls   | `plus`, `check`, `check-square`, `trash`, `warning`                                      |
| Pin / favorites   | `pin`, `pin-filled`, `star`, `star-filled`                                               |
| Visibility        | `eye`, `eye-off`, `eye-slash`                                                            |
| Chevrons / arrows | `chevron-{up,down,left,right}`, `chevron-double-{up,down,left,right}`, `arrow-{up,down}` |
| Drag handle       | `grip`                                                                                   |
| Theme toggle      | `sun`, `moon`                                                                            |
| Loading           | `loading` (spinner)                                                                      |

The complete read-only map is exported as `bakedIcons` (a `Record<string, string>` of alias → SVG markup). The specific Iconify IDs we resolve at our publish time are an internal detail — override by alias name, not by Iconify ID.

## Reading the icon map programmatically

```typescript
import { bakedIcons } from "@atscript/ui-styles";

// Aliases shipped in this version (sorted):
console.log(Object.keys(bakedIcons).sort());

// Raw SVG markup for an alias — useful for embedding in an offline doc:
console.log(bakedIcons.search);
```

`bakedIcons` is effectively read-only. Mutating it after the fact has no effect — `asPresetVunor()` reads it once at preset construction. Use `iconOverrides` to change which SVG ships for an alias.

## Overriding an icon — iconOverrides

```typescript
asPresetVunor({
  iconOverrides: {
    // Replace `i-as-search` everywhere in the UI (search inputs, filters,
    // value-help dialogs, …) with this SVG. The class name doesn't change —
    // only the rendered glyph.
    search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
               <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
               <line x1="16" y1="16" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
             </svg>`,
    // Multiple aliases at once:
    close: '<svg viewBox="0 0 24 24"><path stroke="currentColor" d="..."/></svg>',
    loading: '<svg viewBox="0 0 24 24">...</svg>',
  },
});
```

Two things to know if you want overrides to behave like the bundled icons:

1. **Use `currentColor` for `fill` / `stroke` to inherit text color.** Icons paint via vunor's `scope-*` / `layer-*` system through `currentColor`. A hardcoded `fill="#000"` will keep that exact color across dark mode and tinted scopes (`scope-error`, `scope-good`) — fine if that's what you want; use `currentColor` if you want `i-as-trash` to follow the surrounding scope (red inside `scope-error`, white inside `c8-filled`, etc.).
2. **Set `viewBox`; let `width` / `height` default to `1em` for em-relative sizing.** `@unocss/preset-icons` injects `width: 1em; height: 1em` automatically. Pinning `width="24" height="24"` locks the icon to 24px and bypasses `text-[1.25em]` / `text-[3em]` sizing used by `as-overlay-icon` and similar — fine if you want a fixed pixel icon; use the em default if you want it to track the surrounding text size.

A minimal override SVG looks like:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="currentColor" d="..."/>
</svg>
```

No `width`, no `height`, no hex colors.

## Unknown keys ignored

```typescript
asPresetVunor({
  iconOverrides: {
    brandNonexistent: "<svg>...</svg>", // alias not in bakedIcons
  },
});
```

The unknown key is merged into the resolver's lookup map but won't paint anywhere — no shortcut references `i-as-brand-nonexistent`. No error, no warning. To add a brand-new icon, use the separate-collection path below.

## Adding brand-new icons

Compose `@unocss/preset-icons` alongside `asPresetVunor()` under a different collection prefix. Different prefix = no coordination. `i-as-search` (ours) and `i-lucide-search` (yours) resolve independently.

```typescript
import { defineConfig } from "unocss";
import presetIcons from "@unocss/preset-icons";
import { asPresetVunor, allShortcuts } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  presets: [
    ...asPresetVunor({
      /* options */
    }),
    presetIcons({
      collections: {
        // Iconify JSON sets — lazy-loaded at build time:
        lucide: () => import("@iconify-json/lucide/icons.json").then((i) => i.default),
        // Inline custom SVGs under your own prefix:
        brand: {
          logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">...</svg>',
          // ...
        },
      },
    }),
  ],
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

Use the new icons in your `as-*` shortcut extensions or directly in templates:

```vue
<i class="i-lucide-search text-[1.25em]" />
<i class="i-brand-logo text-[2em]" />
```

UnoCSS preset-icons docs: https://unocss.dev/presets/icons. Available collections: https://icones.js.org.

Note: you can't add brand-new icons by widening `iconOverrides` — unknown keys are ignored (previous section). Use a separate collection prefix instead.

## Em-based sizing rule

Every `as-*` shortcut that paints an icon sizes it with `em` units so the icon tracks the surrounding text size. Example sizings used across the shortcut tree:

| Class           | Size                      | Used by                                  |
| --------------- | ------------------------- | ---------------------------------------- |
| `text-[1em]`    | matches surrounding text  | `as-field-remove-btn-icon`, dialog icons |
| `text-[1.25em]` | slightly larger than text | `as-close-btn`                           |
| `text-[3em]`    | hero overlay icon         | `as-overlay-icon`                        |
| `text-[1.54em]` | "empty state" hero        | `as-vh-empty-icon`                       |

For your own icons, prefer the same pattern:

```vue
<span class="i-lucide-bell text-[1.25em]" />
```

Pinning `w-[16px] h-[16px]` locks the icon to 16px regardless of surrounding text size. Use it when you want a fixed-size glyph; use the em-based form when you want the icon to grow with the text it sits beside.

## Reference grep — i-as-\* usage in shortcuts

To see exactly which alias a UI element paints, search the package's shortcut tree (e.g. inside `node_modules/@atscript/ui-styles/`) for `i-as-`. Example matches:

- `as-overlay-icon: i-as-loading text-[3em]` — the spinner overlay.
- `as-field-remove-btn-icon: i-as-close text-[1em]` — the optional-field clear button.
- `as-table-checkbox-tick: i-as-check size-[0.9em] text-white` — checkbox tick glyph.

If you override `close`, you change the optional-field clear button glyph everywhere; if you override `loading`, you change every in-flight overlay. One alias, every consumer — that's the whole reason aliases exist instead of raw Iconify IDs in the shortcut bodies.
