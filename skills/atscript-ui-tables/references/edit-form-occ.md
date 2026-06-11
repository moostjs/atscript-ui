# edit-form-occ

Edit forms with optimistic concurrency control (OCC): wire a row-edit `<AsForm>` against a moost-db table that carries a `@db.column.version` column, so concurrent edits surface as a typed conflict instead of silent last-write-wins.

Three pieces:

1. `.as` schema opts the table into OCC (`@db.column.version` on one `number.int` field).
2. `createFormDef(type, { versionColumn })` hides the version field from the rendered form.
3. Submit handler discriminates `VersionMismatchError` from `@atscript/db-client`.

## Quick start

```atscript
@db.table 'products'
export interface ProductsTable {
    @meta.id @db.default.increment
    id: number

    @meta.label 'Name'
    name: string

    @db.column.version
    version: number.int
}
```

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
  const meta = await client.meta(); // meta.versionColumn === 'version'
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
      error.value = `Row changed (current version: ${e.currentVersion}). Reload to continue.`;
    } else throw e;
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

## Invariants

| #   | Rule                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/meta` carries `versionColumn` at the top level, but the version field still appears in `meta.fields` like any other — the server adds no hidden/readonly flag. Hiding it is the UI's job via the `createFormDef` opt.                         |
| 2   | `createFormDef(type, { versionColumn })` excludes the field from `fields[]` (nothing renders) but keeps it in `flatMap` and the form data — the PATCH body still carries the loaded version, which the server lifts into `$cas`.                |
| 3   | The opt is a root-table concept — it is not propagated into nested recursive defs.                                                                                                                                                              |
| 4   | `createTableDef` applies the same skip on the table side: the version column never appears as a column or in column-picker / filter / sort dialogs, and `TableDef.versionColumn` carries the name.                                              |
| 5   | `VersionMismatchError` (subclass of `ClientError`) is thrown by the client when the server response body has `kind: 'version_mismatch'`; its `currentVersion` getter exposes the row's current server-side version. Always rethrow non-matches. |
| 6   | Simplest conflict UX wins: tell the user the row changed and ask them to reload. Auto-merge / retry-with-reapplied-edits flows are easy to get wrong — only build them with a specific reason.                                                  |
| 7   | DB-side mechanics (`$cas`, version increment, schema sync, `withOptimisticRetry`) live in the `atscript-db` skill — load it for server behavior.                                                                                                |

## Key imports

```ts
import { createFormDef } from "@atscript/ui"; // opts: { versionColumn?: string }
import { deserializeAnnotatedType } from "@atscript/typescript/utils";
import { Client, VersionMismatchError } from "@atscript/db-client";
import { AsForm } from "@atscript/vue-form";
```

## See also

- Docs (narrative SSOT): https://ui.atscript.dev/tables/edit-form-occ
- `atscript-ui-forms` skill → references/customization.md (Level 4) — `createFormDef(type, { versionColumn })` in the custom-root context
- `atscript-db` skill — `@db.column.version`, `$cas`, `withOptimisticRetry`, schema-sync behavior
- [state-persistence.md](state-persistence.md) — config dialog the version column is excluded from
