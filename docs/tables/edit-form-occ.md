---
outline: deep
---

# Edit forms with optimistic concurrency

When a row can be edited from more than one place at the same time, a naive
"load, edit, save" flow is unsafe: whoever saves second silently overwrites
the first writer's changes. Atscript-ui integrates with `@atscript/db`'s
optimistic concurrency control (OCC) so this surfaces as a clear UX prompt
instead of a silent data loss.

The whole flow is three pieces:

1. Your `.as` schema opts the table into OCC.
2. Your form passes `meta.versionColumn` to `createFormDef` so the version
   field doesn't render as an editable input.
3. Your submit handler catches `VersionMismatchError` from
   `@atscript/db-client` and shows the user a friendly "row changed,
   reload" message.

## 1. Opt the table into OCC

Annotate one `number.int` field with `@db.column.version`:

```atscript
@db.table 'products'
export interface ProductsTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Name'
    name: string

    /// other fields…

    @meta.label 'Version'
    @db.column.version
    version: number.int
}
```

The SQL adapter auto-creates the column with `NOT NULL DEFAULT 0` on schema
sync, so existing rows backfill to version `0` automatically — no migration
script needed. Every successful update increments it.

Your `/meta` response now carries:

```json
{
  "versionColumn": "version",
  "fields": { "id": {}, "name": {}, "version": {} }
}
```

The version field still appears in `meta.fields` like any other column — the
server doesn't add a hidden/readonly flag. Hiding it is the UI's job, which
is exactly what `createFormDef`'s opt is for.

## 2. Hide the version field from the form

Pass `meta.versionColumn` to `createFormDef`:

```ts
import { createFormDef } from "@atscript/ui";
import { deserializeAnnotatedType } from "@atscript/typescript/utils";

const meta = await client.meta();
const formDef = createFormDef(deserializeAnnotatedType(meta.type), {
  versionColumn: meta.versionColumn,
});
```

`AsForm` iterates `def.fields[]` and the version prop is no longer there,
so no input is painted. But the version value still lives on the loaded
row (`formData.value.version`), so when the user hits submit the PATCH
body still carries it — exactly what the server needs to lift into
`$cas`.

`createTableDef` does the same thing on the table side: the version
column never appears in column-picker dialogs, filter dialogs, or sort
dialogs — nothing to configure.

## 3. Handle the 409 on submit

`@atscript/db-client` exports `VersionMismatchError` (a subclass of
`ClientError`). When the server detects a stale write, the client
auto-throws this typed marker with a `currentVersion` accessor:

```ts
import { VersionMismatchError } from "@atscript/db-client";

async function onSubmit(data: unknown) {
  try {
    await client.update(data as never);
    showToast("Saved");
  } catch (e) {
    if (e instanceof VersionMismatchError) {
      showError(
        `Row changed since you opened the form (current version: ` +
          `${e.currentVersion}). Reload the page to continue.`,
      );
    } else {
      throw e;
    }
  }
}
```

The simplest UX is the one shown here: tell the user the row changed and
let them reload. More sophisticated flows (auto-refresh + diff prompt,
retry with re-applied user edits) are possible but easy to get wrong —
pick the plain "reload" path unless you have a specific reason to do
more.

## Putting it together

A complete edit-page wiring loads a row, builds the form def with
`versionColumn`, and discriminates on `VersionMismatchError` at submit:

```vue
<script setup lang="ts">
import { ref, watch } from "vue";
import { AsForm } from "@atscript/vue-form";
import { createFormDef, type FormDef } from "@atscript/ui";
import { deserializeAnnotatedType } from "@atscript/typescript/utils";
import { VersionMismatchError, Client } from "@atscript/db-client";

const props = defineProps<{ url: string; id: string | number }>();

const client = new Client(props.url);
const formDef = ref<FormDef | null>(null);
const record = ref<Record<string, unknown> | null>(null);
const error = ref<string | null>(null);

async function load() {
  const meta = await client.meta();
  formDef.value = createFormDef(deserializeAnnotatedType(meta.type), {
    versionColumn: meta.versionColumn,
  });
  record.value = (await client.one(props.id as never)) as Record<string, unknown>;
}
watch(() => [props.url, props.id], load, { immediate: true });

async function onSubmit(data: unknown) {
  try {
    await client.update(data as never);
  } catch (e) {
    if (e instanceof VersionMismatchError) {
      error.value =
        `Row changed since you opened the form ` +
        `(current version: ${e.currentVersion}). Reload to continue.`;
    } else {
      throw e;
    }
  }
}
</script>

<template>
  <p v-if="error" class="scope-error">{{ error }}</p>
  <AsForm
    v-if="formDef && record"
    :def="formDef"
    :form-data="{ value: record }"
    :types="types"
    @submit="onSubmit"
  />
</template>
```

## Related

- atscript-db's optimistic concurrency reference — the database-side
  mechanics (`$cas`, version column, schema sync, adapter notes).
- [Tables: Config Dialog](/tables/config-dialog) — confirms version
  columns never appear in column/filter/sort dialogs.
- [API: `@atscript/ui` core](/api/ui) — `MetaResponse.versionColumn`,
  `TableDef.versionColumn`, `createFormDef(type, opts)` signatures.
