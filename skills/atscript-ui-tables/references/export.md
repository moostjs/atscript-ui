# export

Exporting the table's data with `useTableExport`. Since 0.1.134.

## Contents

- [What it does](#what-it-does)
- [API](#api)
- [Cell values](#cell-values)
- [Formula escaping](#formula-escaping)
- [Cancelling](#cancelling)
- [Pure pieces in ui-table](#pure-pieces-in-ui-table)
- [Invariants](#invariants)

## What it does

`useTableExport()` exports the table's data **as it is queried right now** — the active filters, sorters, search term, force-filters and the visible column order — paging through every matching row rather than the page on screen.

```vue
<script setup lang="ts">
import { useTableExport, downloadExport } from "@atscript/vue-table";

const { exportRows, exporting, progress } = useTableExport();

async function onExport() {
  downloadExport(await exportRows({ filename: "orders.csv", csv: { bom: true } }));
}
</script>

<template>
  <button :disabled="exporting" @click="onExport">Export CSV</button>
</template>
```

Call it from any component INSIDE `<AsTableRoot>`; outside, pass the context: `useTableExport(useTableContext())`.

The query comes from `state.buildQuery()` and runs through `state.fetchPage()` — the same seams the on-screen fetch uses, so a custom `:query-fn` is honoured. Three differences from a page fetch:

1. `$select` is the export's column list, and client-owned [display columns](customization.md#display-only-columns-displaycolumns-since-01134) are stripped from it.
2. `$sort` gets the table's `primaryKeys` appended as a tiebreaker (`withStableOrder`) — without it, rows tying on every user sorter can swap between requests and paging skips or duplicates.
3. `$actions` is never requested.

## API

```ts
function useTableExport(ctx?: TableContext): {
  // Rejects while a run is in flight — one handle runs one export at a time.
  exportRows: (opts?: ExportRowsOptions) => Promise<ExportResult>;
  exporting: ComputedRef<boolean>; // derived from progress
  progress: Ref<{ done: number; total?: number } | null>; // null = idle
};

function downloadExport(result: ExportResult): boolean; // false when there is no DOM (SSR)
```

| Option       | Default        | Effect                                                                                     |
| ------------ | -------------- | ------------------------------------------------------------------------------------------ |
| `columns`    | `"visible"`    | Visible columns in display order MINUS client-owned ones, or an explicit list of paths.    |
| `format`     | `"csv"`        | `"csv"` → `{ csv, filename }`; `"rows"` → `{ rows }` (arrays of scalars).                  |
| `pageSize`   | `500`          | Rows per request.                                                                          |
| `filename`   | `"export.csv"` | `.csv` appended when missing.                                                              |
| `csv`        | —              | CSV writer settings: `{ bom?, escapeFormulas?, delimiter? }`. Ignored by `format: "rows"`. |
| `maxRows`    | —              | Hard ceiling.                                                                              |
| `signal`     | —              | `AbortSignal`; rejects with an `AbortError` between pages.                                 |
| `onProgress` | —              | `(done, total?)` per settled page; `total` = first page's `count`.                         |
| `formatCell` | —              | Global formatter; `undefined` falls through to the default.                                |
| `formatters` | —              | Per-column formatters keyed by path; win over `formatCell`.                                |

A client-owned [display column](customization.md#display-only-columns-displaycolumns-since-01134) is left out of `columns: "visible"` — no server field backs it — unless `formatters[path]` fills it. An explicit `columns` list always exports it.

Every result carries `columns` (labels), `columnPaths`, `rowCount` and `total`; `format: "csv"` adds `csv` + `filename`, `format: "rows"` adds `rows`.

## Cell values

Defaults use the same column metadata the cells read: union/enum keys → option **labels**, `Date` → ISO 8601, arrays joined with `", "`, other objects JSON, numbers/booleans stay scalars, `null`/`undefined` → empty field.

```ts
await exportRows({
  formatters: {
    total: (value) => Number(value ?? 0),
    createdAt: (value) => new Date(String(value)).toLocaleDateString("de-DE"),
  },
});
```

## Formula escaping

A STRING cell starting with `=`, `+`, `-`, `@`, TAB or CR is executed as a formula by spreadsheet apps. By default each gets a leading `'`. Turn it off only for parser-consumed files: `csv: { escapeFormulas: false }`. Numbers and booleans are never touched, so `-5` stays numeric; a formatter that returns the string `"-5"` is user content again and gets the apostrophe.

## Cancelling

```ts
const controller = new AbortController();
const promise = exportRows({ signal: controller.signal });
controller.abort();
// promise rejects with an Error whose `name === "AbortError"`
```

The signal is checked before and after every request, so a cancel lands between pages, never mid-flight.

## Pure pieces in ui-table

Usable without Vue: `toCsv` / `csvCell` (RFC 4180 writer, `\r\n` rows, optional BOM), `collectExportRows` / `withStableOrder` / `ExportAbortError` (the pager — pass `mapRow` to project each row as it arrives instead of collecting raw rows), `resolveExportValue` (value resolver), `DEFAULT_EXPORT_PAGE_SIZE`.

## Invariants

| #   | Rule                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | **Never hand-roll the export query.** Use `state.buildQuery()` / `state.fetchPage()` (what the hook does) — a re-implementation drifts from force-filters, `selectWith` and `alwaysSelected`. |
| E2  | **Always keep a stable order when paging.** `withStableOrder` appends the pk; dropping it silently skips and duplicates rows on ties.                                                         |
| E3  | **Don't raise `pageSize` to "one big page".** The tiebreak makes paging safe; a huge page is what times out.                                                                                  |
| E4  | **Keep `csv.escapeFormulas` on for spreadsheet files.** It is the CSV-injection defence.                                                                                                      |
| E6  | **One run per handle.** A second `exportRows()` while one is in flight rejects — disable the trigger with `exporting` instead of racing two runs.                                             |
| E5  | **Server-side exports stay custom actions.** Use `processor: 'custom'` + `@action` when the file is produced by the backend; the hook is for the data the user is looking at.                 |

## See also

- [actions-selection.md](actions-selection.md) — the custom-action export route
- [query.md](query.md) — `buildTableQuery`, force filters, `ReactiveTableState`
- Docs: https://ui.atscript.dev/tables/export
