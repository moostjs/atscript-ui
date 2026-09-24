---
outline: deep
---

# Fields Hidden by Role

When the server hides fields from a role, a table built for a wider role
can still hand that role a view that names them: an admin's public
preset, a link someone shared, a bookmark kept across a role change, a
local draft. The server rejects any query that names a field it does not
expose to the caller. _Since 0.1.141_ the table never sends one: it drops
the parts it cannot use, keeps the rest, and tells you what it dropped.

```vue
<AsTableRoot
  url="/api/db/tables/users"
  v-model:url-query="urlQuery"
  :preset="{ url: '/api/db/_presets', tableKey: 'users' }"
  @fields-dropped="(r) => notify(`Not available to you: ${r.fields.join(', ')}`)"
>
  <AsTableActions>
    <AsPresetPicker />
  </AsTableActions>
  <AsTable />
</AsTableRoot>
```

Nothing to configure: pruning is always on. The event is optional.

## Which fields a table can use

The table reads `/meta` for the caller. A field is **readable** when it is
listed in `/meta.fields` and not marked `writeOnly`, and only readable
fields become columns:

- A `writeOnly` field (an access-control projection that lets the role
  write the field but not read it) is not a column and is not fetchable,
  so `@ui.table.selectWith` / `alwaysSelected` cannot pull it in either.
- A top-level field that is in `/meta.type` but missing from
  `/meta.fields` is not a column.

Up to 0.1.140 both still became columns, so the Standard view of a
write-but-not-read role failed with a 400 with no preset involved.

Everything below prunes against the column list the table built:

| Aspect                       | Allowed paths                                                             |
| ---------------------------- | ------------------------------------------------------------------------- |
| Columns, widths, sorters     | Every column, [client-owned](/tables/cells#display-only-columns) included |
| Filter inputs, field filters | Server-backed columns                                                     |
| Custom filter conditions     | Server-backed columns (every field the condition names)                   |

## What is pruned, and how

Two writers are pruned when they apply, and each apply that drops
something is reported:

| Source                                                                                                                              | Report `source` |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| A preset: picker switch, reset, a snapshot passed to `state.preset.apply`, and the default preset with the local draft laid over it | `"preset"`      |
| A restored URL (deep link, shared link, Back/Forward)                                                                               | `"url"`         |

The default preset is applied only once `/meta` has loaded, so it is
pruned like any other apply.

Everything else writes the model directly: initial `v-model` values,
`setFieldFilter`, `addFilterField`, `setResidualFilters`. That state is
kept as written, and the query leaves the unusable fields out. The
column list and `<AsFilters>` already skip unknown paths. No report is
sent for these; a development build warns once per set of paths.

The rules are the same everywhere:

- **Columns** keep their order. If none survives, the table shows every
  column instead of an empty grid.
- **Field filters** go per field. A field's conditions are one AND-ed
  piece, so dropping it only broadens the result.
- **Custom filter conditions** go whole when they name an unusable field
  anywhere, even inside an `$or` or `$not`. Pruning inside would narrow
  the result or invert it; dropping the whole piece only broadens it.
- **Sorters** keep their priority; a dropped one changes only the order.
- `itemsPerPage` is never touched.

The query builder is the guarantee: it gates `$select` (by the column
list, with client-owned columns stripped), `$sort` and the filters, so no
table state can send an unusable field, whoever wrote it.

## Presets

- The stored preset is never rewritten on apply. An admin who wrote it
  keeps every field; each role sees the part it can use.
- `state.preset.activeSnapshot` is the pruned snapshot, so a preset
  applied without its hidden fields is **not** dirty.
- `state.preset.droppedFields` holds the report while that preset stays
  active. `<AsPresetPicker>` shows a quiet note in its menu: "Some fields
  in this preset aren't available to you."
- **Save** (overwrite, owner only) adds the hidden entries back: hidden
  columns, filter inputs and sorters go after the visible ones, hidden
  field filters are kept as they were. Widths of hidden columns are not
  kept. An owner whose role was narrowed does not silently destroy what
  they can no longer see.
- **Save as…** stores only what the saver can see.

## URLs

- The address bar keeps the link as it came. The next change writes the
  table's own URL, without the dropped parts. Back/Forward and re-sharing
  the link with a role that can see those fields keep working.
- Filter pieces and `$sort` entries on unusable fields are reported. A
  bare `field=value` on an unknown field is dropped silently: without the
  table definition it reads the same as a flag of the host page.
- A URL piece that mixes a usable field with an unusable one is reported
  here, not as [`@unsupported-filter`](/tables/url-state#links-the-filter-model-cannot-hold).
  That event keeps its meaning: a piece the filter model cannot express.
  (Up to 0.1.140 such a mixed piece went to `@unsupported-filter`.)

## The report

`@fields-dropped` (renderless: `useTable({ onFieldsDropped })`) fires once
per apply, only when something was dropped:

| Field          | Holds                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| `source`       | `"preset"` or `"url"`, see above                                          |
| `presetId`     | The preset applied (`"preset"`)                                           |
| `fields`       | The unusable paths behind the drops: what to show the user                |
| `columns`      | Dropped column names                                                      |
| `filterFields` | Dropped filter inputs                                                     |
| `filters`      | Dropped field filters, one entry per field                                |
| `residual`     | Dropped custom filter conditions; for `"url"`, every dropped filter piece |
| `sorters`      | Dropped sorters                                                           |

With no listener, each report is a `console.warn` in development builds.

## `forceFilters` and `forceSorters`

`:force-filters` and `:force-sorters` are **not** pruned. The app wrote
them to narrow the view on purpose, and dropping one silently would widen
it. Keep them to fields every role can read, or make them depend on the
role.

## Do / Don't

- **Do** bind `@fields-dropped` where roles differ, and show `fields` as
  a toast or an inline note.
- **Do** keep system presets (`:preset.systemPresets`) on fields every
  role reads. A hidden field there degrades cleanly, but every such role
  then sees the note on its default view.
- **Don't** treat the report as an error. It means the table did the
  right thing with a view written for someone else.
- **Don't** rely on pruning to hide data. The server's field projection
  is what hides it; pruning only keeps the client from asking for it.

## Framework-agnostic helpers

`@atscript/ui-table` exports the pure pieces for custom renderers:
`prunePresetSnapshot`, `pruneResidualFilters`, `restoreDroppedEntries`
and the `KnownFields` / `DroppedFields` types. `decomposeUniqueryFilter`
and `urlQueryStringToState` return pieces on unknown fields as `unknown`
(each with the unknown paths it names), and the parser returns `$sort`
entries on them as `unknownSorters`. Pass client-owned column paths to
the parser as `localFields` so it does not count them as unknown.
Signatures are in the
[`@atscript/ui-table` API reference](/api/ui-table#hidden-field-pruning).

## Next steps

- [Presets](/tables/presets): the snapshot model and the picker.
- [URL State](/tables/url-state): links, `$snapshot`, and pieces the
  filter model cannot hold.
