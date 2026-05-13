---
outline: deep
---

# Tuples

Fixed-length positional arrays in `.as` types — `[A, B, C]` — render
through the `AsTuple` default. Each position has a fixed type;
positions can be individually labelled; the tuple auto-pads to its
declared length on mount.

## Declaring a tuple

```atscript
@meta.label 'Brand color'
@meta.description 'RGB channel triple, 0-255.'
logoRgb: [number, number, number]
```

A tuple position can carry its own annotations:

```atscript
coords: [
    @meta.label 'Latitude'
    @expect.min -90, 'Latitude must be ≥ -90'
    @expect.max 90, 'Latitude must be ≤ 90'
    number,

    @meta.label 'Longitude'
    @expect.min -180, 'Longitude must be ≥ -180'
    @expect.max 180, 'Longitude must be ≤ 180'
    number
]
```

The default `AsTuple` renderer iterates positions, dispatching each to
`<AsField>` with `array-index` set so the position labels read as
`Latitude #1`, `Longitude #2` (or just the position label when one is
set with `@meta.label`).

## Auto-padding

`useAsTuple()` runs an `onMounted` hook that fills missing positions
with their type's default value — non-optional tuples are guaranteed
to be the correct length before the user sees them
(`packages/vue-form/src/composables/use-as-tuple.ts:45-71`).

```ts
function fillMissing() {
  let arr = getByPath(pathPrefix.value);
  if (!Array.isArray(arr)) {
    arr = [];
    setByPath(pathPrefix.value, arr);
  }
  if (arr.length >= itemFields.length) return;
  for (let i = arr.length; i < itemFields.length; i++) {
    arr.push(createFormData(field.itemFields[i].prop, resolver).value);
  }
}
```

Optional tuples (`coords?: [number, number]`) skip the auto-pad until
the user toggles them on; clear() then resets them to `undefined`.

## Custom tuple renderer

A `RgbPicker` custom tuple — three R/G/B sliders + a live preview
swatch.

```vue
<script setup lang="ts">
import { computed } from "vue";
import { AsFieldShell, type TAsComponentProps, useAsTuple } from "@atscript/vue-form";
import type { FormTupleFieldDef } from "@atscript/ui";

const props = defineProps<TAsComponentProps<[number, number, number] | null | undefined>>();
useAsTuple(props.field as FormTupleFieldDef);

function readChannel(idx: number): number {
  const v = props.model.value;
  if (!Array.isArray(v)) return 0;
  const n = v[idx];
  return typeof n === "number" && Number.isFinite(n) ? clamp(n) : 0;
}

function clamp(n: number): number {
  if (n < 0) return 0;
  if (n > 255) return 255;
  return Math.round(n);
}

function setChannel(idx: number, raw: number): void {
  const next: [number, number, number] = [readChannel(0), readChannel(1), readChannel(2)];
  next[idx] = clamp(raw);
  props.model.value = next;
}

const r = computed(() => readChannel(0));
const g = computed(() => readChannel(1));
const b = computed(() => readChannel(2));
const rgbCss = computed(() => `rgb(${r.value}, ${g.value}, ${b.value})`);
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default>
      <input
        type="range"
        min="0"
        max="255"
        :value="r"
        @input="(e) => setChannel(0, +e.target.value)"
      />
      <input
        type="range"
        min="0"
        max="255"
        :value="g"
        @input="(e) => setChannel(1, +e.target.value)"
      />
      <input
        type="range"
        min="0"
        max="255"
        :value="b"
        @input="(e) => setChannel(2, +e.target.value)"
      />
      <div :style="{ backgroundColor: rgbCss }" />
    </template>
  </AsFieldShell>
</template>
```

Two design notes:

- **`useAsTuple` is consumed for its `fillMissing` `onMounted` hook
  only.** The per-position itemFields / clear API isn't used because
  the UI is one integrated widget rather than three nested AsField
  shells.
- **`AsFieldShell` provides the label/description/error chrome.** The
  custom renderer focuses on the value-editing UI itself.

Opt in per field with `@ui.form.component`:

```atscript
@ui.form.component 'rgb-picker'
logoRgb: [number, number, number]
```

Register in the components map:

```ts
const components = { "rgb-picker": RgbPicker };
```

## `useAsTuple` return

```ts
const {
  itemFields, // FormFieldDef[] — one per position, with index path
  positionLabeled, // boolean[] — whether each position carries @meta.label
  isOptional, // boolean — from prop.optional
  isEmpty, // ComputedRef<boolean> — value is missing / empty array
  clear, // () => void — optional tuples only; resets to undefined
  fillMissing, // () => void — pad to declared length
} = useAsTuple(field as FormTupleFieldDef);
```

`positionLabeled[i] === true` means the position carries
`@meta.label`. The default `AsTuple` uses this to decide whether to
render a `#N` index suffix — if every position is labelled, the
suffix is suppressed.

## Validation

Tuples participate in the regular validation pipeline. Per-position
`@expect.*` annotations validate the corresponding array slot at
submit time; the error path uses the index (`logoRgb.0`,
`logoRgb.1`, …).

```atscript
@meta.label 'Hue'
@expect.min 0, 'Hue must be ≥ 0'
@expect.max 359, 'Hue must be ≤ 359'
hsl: [number, number, number]
```

For multi-position constraints (e.g. "saturation + lightness must sum
to at most 100"), use a tuple-level `@ui.form.validate`:

```atscript
@meta.label 'HSL'
@ui.form.validate '(v) => v[1] + v[2] <= 100 || "S + L must be ≤ 100"'
hsl: [number, number, number]
```

## Tuples vs arrays vs unions

| Need                                 | Use       |
| ------------------------------------ | --------- |
| Fixed-length positional, typed slots | `tuple`   |
| Variable-length, homogeneous items   | `array`   |
| One-of-N shapes, with detection      | `union`   |
| Variable-length, heterogeneous items | `union[]` |

A tuple is **not** the right shape for "two of the same thing"
(use `string[]` with `minLength: 2`, `maxLength: 2`) or for a
"struct with a fixed key set" (use an object).

## Next steps

- [Custom Components](/forms/custom-components) — the full Tier-2
  swap-target workflow.
- [Unions](/forms/unions) — the other variant-aware structural field.
- [Annotations](/forms/annotations) — the full reference, including
  `@expect.*` rules used here.
