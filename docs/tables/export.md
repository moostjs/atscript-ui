---
outline: deep
---

# Export

`useTableExport()` exports the table's data **as it is queried right
now** — the active filters, sorters, search term, force-filters and the
visible column order all come along. It pages through every matching
row (not just the page on screen) and hands back either a CSV string or
plain scalar arrays.

Since 0.1.134.

## Quick start

```vue
<script setup lang="ts">
import { useTableExport, downloadExport } from "@atscript/vue-table";

const { exportRows, exporting } = useTableExport();

async function onExport() {
  downloadExport(await exportRows({ filename: "orders.csv" }));
}
</script>

<template>
  <button :disabled="exporting" @click="onExport">Export CSV</button>
</template>
```

The composable reads the table context, so call it from any component
**inside** `<AsTableRoot>` — a toolbar button, a menu item, a custom
control. Outside the subtree, pass the context explicitly:
`useTableExport(useTableContext())`.

## What the export sends

`exportRows` snapshots the table's own query through
`state.buildQuery()` — the same builder the on-screen fetch uses — and
runs it through `state.fetchPage()`, so a custom `:query-fn` is honoured
too. Two things are different from a normal page fetch:

- **`$select`** is the export's column list, not the table's.
  Client-owned [display columns](/tables/customization#display-only-columns)
  are stripped: they have no server field behind them.
- **`$sort`** gets the table's primary key(s) appended as a tiebreaker.
  Without it, two rows that tie on every user sorter can swap places
  between requests, and paging would skip or duplicate rows.

`$actions` is never requested — an export has no action chrome to gate.

## Options

```ts
const result = await exportRows({
  columns: "visible", // or ["id", "customer.name", "total"]
  format: "csv", // or "rows"
  pageSize: 500,
  filename: "orders.csv",
  csv: { bom: true, escapeFormulas: true, delimiter: "," },
  maxRows: 50_000,
  signal: controller.signal,
  onProgress: (done, total) => console.log(done, total),
  formatCell: (value, column, row) => undefined,
  formatters: { total: (value) => Number(value) },
});
```

| Option       | Default        | What it does                                                                   |
| ------------ | -------------- | ------------------------------------------------------------------------------ |
| `columns`    | `"visible"`    | Visible columns in display order, or an explicit list of paths in that order.  |
| `format`     | `"csv"`        | `"csv"` → `{ csv, filename }`; `"rows"` → `{ rows }` (arrays of scalars).      |
| `pageSize`   | `500`          | Rows per request while paging.                                                 |
| `filename`   | `"export.csv"` | `.csv` is appended when missing.                                               |
| `csv`        | —              | CSV writer settings: `bom`, `escapeFormulas`, `delimiter`. See below.          |
| `maxRows`    | —              | Hard ceiling; the pager stops once it is reached.                              |
| `signal`     | —              | `AbortSignal`; the promise rejects with an `AbortError` between pages.         |
| `onProgress` | —              | `(done, total?)` after each settled page. `total` is the first page's `count`. |
| `formatCell` | —              | Global cell formatter.                                                         |
| `formatters` | —              | Per-column formatters keyed by column path; they win over `formatCell`.        |

The `csv` block goes straight to the writer:

| `csv` key        | Default | What it does                                                          |
| ---------------- | ------- | --------------------------------------------------------------------- |
| `bom`            | `false` | Prepend a UTF-8 BOM — Excel needs it to detect UTF-8 on double-click. |
| `escapeFormulas` | `true`  | CSV-injection defence, see below.                                     |
| `delimiter`      | `","`   | Field delimiter.                                                      |

The returned handle also exposes `progress` — `{ done, total? }` while a
run is in flight, `null` when idle — and `exporting`, derived from it, for
wiring a button's disabled state and a progress bar without threading
`onProgress` yourself. One handle runs **one** export at a time: calling
`exportRows` again while a run is in flight rejects instead of letting two
runs share (and clear) the same progress.

Client-owned [display columns](/tables/customization#display-only-columns)
are left out of the default `columns: "visible"` set — no server field
backs them, so they would export as an empty column. Give one a
`formatters` entry (or list it in an explicit `columns` array) and it
exports.

## Cell values

Values come out of the same column metadata the cells read:

- union / enum columns export the option's **label**, not its key;
- `Date` values export as ISO 8601 (re-importable, unlike a
  locale-formatted date);
- arrays join with `", "`, other objects become JSON;
- numbers and booleans stay scalars, so a spreadsheet keeps them numeric;
- `null` / `undefined` become an empty field.

Override one column with `formatters`, or everything with `formatCell`.
Returning `undefined` from either falls through to the default.

```ts
await exportRows({
  formatters: {
    total: (value) => Number(value ?? 0),
    createdAt: (value) => new Date(String(value)).toLocaleDateString("de-DE"),
  },
});
```

## Formula escaping

A CSV cell that starts with `=`, `+`, `-`, `@`, TAB or CR is executed as
a formula by spreadsheet apps — which is how a exported row of user
content turns into an attack on whoever opens the file. By default every
such cell gets a leading `'` so it stays text. Turn it off only when the
file is consumed by a parser rather than a spreadsheet:

```ts
await exportRows({ csv: { escapeFormulas: false } });
```

Only **string** cells are guarded. A numeric cell keeps its own minus
sign (`-5` stays `-5`), so a spreadsheet still reads it as a number — but
a `formatters` entry that returns `"-5"` as text is user content again,
and gets the apostrophe.

## Cancelling

```ts
const controller = new AbortController();
const promise = exportRows({ signal: controller.signal });
// …user clicks Cancel
controller.abort();

try {
  downloadExport(await promise);
} catch (err) {
  if ((err as Error).name !== "AbortError") throw err;
}
```

The signal is checked before and after every request, so a cancel lands
between pages — never mid-flight.

## Building your own file format

`format: "rows"` returns `{ columns, columnPaths, rows, rowCount }` with
`rows` as arrays of scalars in the same order as `columns`. Feed it to
an XLSX writer, a PDF table, or an upload:

```ts
const { columns, rows } = await exportRows({ format: "rows" });
const sheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);
```

## The pure pieces

The framework-agnostic halves live in `@atscript/ui-table` and are
usable without Vue: `toCsv` / `csvCell` (RFC 4180 writer),
`collectExportRows` / `withStableOrder` (the pager) and
`resolveExportValue` (the value resolver). See the
[`@atscript/ui-table` API](/api/ui-table#export).

## Custom actions still work

An export that must run **server-side** (a big report, a signed URL) is
still best modelled as a `processor: 'custom'` table action matched by
name in `@action` — see
[Actions & Selection](/tables/actions#custom-actions). Use the native
hook when the data the user sees is the data they want.

## DOs and DON'Ts

- **DO** export from inside `<AsTableRoot>` so the query is the one on
  screen.
- **DO** pass `csv: { bom: true }` when the file is opened in Excel.
- **DON'T** raise `pageSize` to "one big page" — the tiebreak sort makes
  paging safe, and a huge page is what times out.
- **DON'T** disable `csv.escapeFormulas` for files a human opens in a
  spreadsheet.
- **DON'T** start a second export on the same handle while one runs — it
  rejects; disable the button with `exporting` instead.
