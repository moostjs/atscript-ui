# Locale & Currency

Decimal separators, thousands grouping, currency symbols, and date/time
formatting all key off a single BCP-47 locale string. `<AsForm>` resolves it
through `useAsLocale()`, which reads from the nearest `provideAsLocale()`
ancestor — typically the app shell.

## Provide once at the shell

`provideAsLocale(getter)` takes a function that returns a BCP-47 locale (or
`undefined`). Wire it from your app prefs / user-settings reactive source:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { provideAsLocale } from "@atscript/vue-form";
import { provideCellLocale, useAppPrefs } from "@atscript/vue-table";
import { clientFactory } from "@/api/client-factory";

const { prefs } = useAppPrefs({ url: "/api/db/_presets", clientFactory });

// Forms — drives decimal separator, currency symbol, AsDate/AsDatetime formatting.
provideAsLocale(() => prefs.value.language);

// Tables — same source, separate provider for the table side.
provideCellLocale(
  computed(() => ({
    language: prefs.value.language,
    timezone: prefs.value.timezone,
  })),
);
</script>

<template>
  <div>
    <SidebarNav />
    <main><slot /></main>
  </div>
</template>
```

Two providers because forms and tables intentionally don't depend on each
other — both read from the same source on the host side.

`useAsLocale()` returns `{ locale: ComputedRef<string | undefined> }`. When no
provider is present (`undefined`), built-in components fall back to the
browser's runtime locale via `new Intl.NumberFormat(undefined, ...)`.

## Inside a custom field

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useAsLocale, type TAsComponentProps } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps<number | null | undefined>>();
const { locale } = useAsLocale();

const formatted = computed(() => {
  if (props.model.value == null) return "";
  return new Intl.NumberFormat(locale.value ?? undefined).format(props.model.value);
});
</script>
```

The same source feeds the built-in `AsNumber`, `AsDecimal`, `AsDate`,
`AsDatetime`, and `AsTime` defaults — they all read `useAsLocale()` internally.

## Currency

Two annotations declare a decimal field as a currency amount.

### Static currency

```atscript
@meta.label 'Price'
@db.amount.currency 'USD'
@db.column.precision 10, 2
price: decimal
```

`AsDecimal` renders the locale-narrow currency symbol as a prefix adornment,
clamps display scale to the currency's natural decimals (USD → 2, JPY → 0),
and stores the canonical decimal string honoring `@db.column.precision`.

### Currency from a sibling

```atscript
@meta.label 'Currency'
currencyCode: string

@meta.label 'Amount'
@db.amount.currency.ref 'currencyCode'
@db.column.precision 10, 2
amount: decimal
```

Now the same field renders `$1,234.50`, `€1.234,50`, or `¥1235` depending on
what `currencyCode` resolves to in the same record. Useful for multi-currency
invoices.

The resolved `currencyCode` and `prefix` flow through `TAsComponentProps`:

| Prop           | Holds                                                |
| -------------- | ---------------------------------------------------- |
| `currencyCode` | The symbolic identifier (`'USD'`, `'EUR'`, …)        |
| `prefix`       | The locale-aware narrow symbol (`'$'`, `'€'`, `'¥'`) |
| `scale`        | Effective fractional digits (currency-clamped)       |

Both are reactive — flip the sibling's value and the prefix updates.

## Units of measure

`@db.unit` is the unitless counterpart of `@db.amount.currency`. It paints the
unit code as a **suffix adornment**:

```atscript
@meta.label 'Weight'
@db.unit 'kg'
@db.column.precision 6, 2
weight: decimal

@meta.label 'Speed'
@db.unit.ref 'speedUnit'
speed: decimal
```

The `unitCode` and `suffix` props on `TAsComponentProps` carry the same string
when resolved from a unit annotation.

## Precision and scale

`@db.column.precision precision, scale` caps storage:

- `precision` = total significant digits
- `scale` = maximum fractional digits

`AsDecimal` reads both — outgoing values are padded to `scale`, display values
clamp to `min(currencyDecimals, scale)`.

Without `@db.amount.currency`, only the scale matters for the form:

```atscript
@meta.label 'Tax rate'
@db.column.precision 5, 4
taxRate: decimal
```

Renders with 4 fractional digits regardless of locale.

## Date and time

`AsDate`, `AsDatetime`, and `AsTime` use the resolved locale for formatting:

```atscript
@meta.label 'Published'
publishedAt?: number.timestamp
```

A timestamp field (`number.timestamp`) routes through `datetime` in the default
types map; pair with `@ui.form.type 'date'` to get a date-only renderer.

The timezone is **not** owned by `provideAsLocale` — only the language. For
table cells, `provideCellLocale` carries both `language` and `timezone`. Form
date inputs use the runtime timezone by default; pass an explicit timezone via
`@ui.form.attr` or a custom `AsDate` swap if you need a fixed one.

## Tables, briefly

The table side has its own provider, `provideCellLocale`, exported from
`@atscript/vue-table`. It carries `{ language, timezone }`. Wire both from the
same source at the shell — see [Table cells](/tables/cells).

## Worked example — multi-currency line item

```atscript
@meta.label 'Line item'
export interface LineItem {
    @meta.label 'Description'
    description: string

    @meta.label 'Currency'
    @ui.form.options 'USD', 'EUR', 'GBP', 'JPY'
    @ui.form.grid.colSpan 'third'
    currencyCode: ui.select

    @meta.label 'Unit price'
    @db.amount.currency.ref 'currencyCode'
    @db.column.precision 12, 2
    @ui.form.grid.colSpan 'third'
    unitPrice: decimal

    @meta.label 'Quantity'
    @db.unit 'pcs'
    @ui.form.grid.colSpan 'third'
    quantity: number

    @meta.label 'Weight'
    @db.unit.ref 'weightUnit'
    weight?: decimal

    @meta.label 'Weight unit'
    @ui.form.options 'kg', 'lb'
    weightUnit?: ui.select
}
```

Inside a `<AsForm>` mounted under a `provideAsLocale(() => 'de-DE')` ancestor,
`unitPrice` reads as `€ 1.234,50`. Switch the currency dropdown to `'JPY'` and
it becomes `¥ 1235` — display scale drops to 0, no fractional digits.

## Next steps

- [Field types](/forms/field-types) — built-in renderers and their adornments
- [Custom components](/forms/custom-components) — call `useAsLocale` inside your own widget
- [Table cells](/tables/cells) — `provideCellLocale` and per-cell formatting
