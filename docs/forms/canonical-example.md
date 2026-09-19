---
outline: deep
---

# The canonical example

One complete edit form, end to end: a compiled `.as` type, `createAsFormDef`,
the default type map plus one custom control, a PATCH built from the change
tracker with optimistic concurrency, a version-mismatch recovery, and server
validation errors mapped back onto the fields.

Every other forms page zooms in on one of those pieces. This page is the piece
that shows how they fit together, so you don't have to guess which plausible
combination is the real one.

::: tip This page is executable
The component below is
`packages/vue-form/src/__tests__/fixtures/canonical-form.vue` verbatim — only
the imports differ (in the repo they point at the sources instead of the
package). It is type-checked and mounted by
`packages/vue-form/src/__tests__/canonical-form.spec.ts`, which asserts the
behaviours called out along the way.
:::

## 1. The type

`src/forms/ServiceTicket.as`. Nothing about the form lives in the Vue file that
could live here instead.

```atscript
/// One row of a support desk. `version` is the optimistic-concurrency column:
/// it is never written as a normal field, only round-tripped through `$cas`.
@meta.label 'Service Ticket'
@ui.form.submit.text 'Save'
export interface ServiceTicket {
    @meta.id
    @ui.form.hidden
    id: number

    @meta.label 'Subject'
    @meta.required 'Subject is required'
    subject: string

    /// Rendered by the custom `priority` control registered in `types`.
    @meta.label 'Priority'
    @ui.type 'priority'
    priority: 'low' | 'normal' | 'high'

    @meta.label 'Notes'
    notes?: string

    @db.column.version
    @ui.form.hidden
    version: number
}
```

Three things the rest of the page depends on:

- `@db.column.version` makes the form's patch carry `$cas` — see
  [Change tracking](/forms/change-tracking#optimistic-concurrency-cas).
- `@ui.type 'priority'` is an **open-ended** renderer key: any string you also
  register in the `types` map. Everything else keeps its default renderer.
- `@ui.form.hidden` keeps `id` / `version` in the data but off the screen.

## 2. The component

```vue
<script setup lang="ts">
import { ref, watch } from "vue";
import { ClientError, VersionMismatchError, type Client } from "@atscript/db-client";
import type { FormFieldChange, FormRebaseOptions } from "@atscript/ui";
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { ServiceTicket } from "../forms/ServiceTicket.as";
import TicketPriority from "./TicketPriority.vue";

const props = defineProps<{
  /** Primary key of the row being edited. */
  id: number;
  /** `new Client<typeof ServiceTicket>('/api/tickets')` in an app. */
  client: Client<typeof ServiceTicket>;
}>();

// One custom control, registered under the key `@ui.type 'priority'` names.
// Everything else keeps its default renderer.
const types = { ...createDefaultTypes(), priority: TicketPriority };

// `def` describes WHAT to render; `formData` is the wrapped container
// `{ value: domainData }` with every `@meta.default` already applied.
const { def, formData } = createAsFormDef(ServiceTicket);

// The slice of `<AsForm>`'s `defineExpose` surface this page drives. `AsForm`
// is a generic component, so a structural handle types the template ref more
// cleanly than `InstanceType<typeof AsForm>`.
type AsFormHandle = {
  getPatch: () => Record<string, unknown>;
  rebase: () => void;
  rebaseOnto: (
    upstream: Record<string, unknown>,
    opts?: FormRebaseOptions,
  ) => { conflicts: string[]; reapplied: FormFieldChange[] };
};

const asForm = ref<AsFormHandle | null>(null);
const loading = ref(true);
// Server-side field errors, keyed by dotted path (`__form` = form-level banner).
const serverErrors = ref<Record<string, string>>({});
const notice = ref("");

async function load(): Promise<void> {
  loading.value = true;
  try {
    const row = await props.client.one({ id: props.id });
    // Fill the SAME container, whenever you like — before or after the form
    // mounts. Replacing `.value` on a CLEAN form re-baselines the change
    // tracker onto the loaded row (since 0.1.134), so the form is not born
    // dirty against the defaults `createAsFormDef` seeded.
    if (row) formData.value = row;
  } finally {
    loading.value = false;
  }
}
watch(() => props.id, load, { immediate: true });

// `@submit` fires with the unwrapped domain data once the type's own
// validation passes. An edit form ignores that payload and sends the PATCH
// instead: `getPatch()` is the minimal diff against the loaded row, and it
// carries `$cas: { version }` because the type has a `@db.column.version`
// column. Nothing changed ⇒ `{}` ⇒ no request at all.
async function onSubmit(): Promise<void> {
  const patch = asForm.value!.getPatch();
  if (Object.keys(patch).length === 0) {
    notice.value = "No changes";
    return;
  }
  serverErrors.value = {};
  notice.value = "";
  try {
    // `getPatch()` is a runtime diff (`Record<string, unknown>`), so the client's
    // typed write signature needs a cast at this boundary.
    await props.client.update({ id: props.id, ...patch } as never);
    // Saved: the current data becomes the new baseline — the form goes clean
    // without a remount, and the next patch diffs against what we just wrote.
    asForm.value!.rebase();
    notice.value = "Saved";
  } catch (e) {
    await onSubmitFailed(e);
  }
}

async function onSubmitFailed(e: unknown): Promise<void> {
  // 409 + `kind: 'version_mismatch'` — somebody else wrote the row first.
  // Reload it and fold the fresh values UNDER the user's unsaved edits, so
  // nothing they typed is lost and the new baseline carries the new version
  // (the next `getPatch()` lifts `$cas` against it).
  if (e instanceof VersionMismatchError) {
    const fresh = await props.client.one({ id: props.id });
    const { conflicts } = asForm.value!.rebaseOnto({ value: fresh }, { conflict: "ours" });
    notice.value = conflicts.length
      ? `Row changed on the server — kept your edits to: ${conflicts.join(", ")}`
      : "Row changed on the server — your edits were merged in";
    return;
  }
  // 400 validation envelope: `{ message, statusCode, errors: [{ path, message }] }`.
  // Map it onto the fields; an entry without a path becomes the form banner.
  if (e instanceof ClientError) {
    const mapped: Record<string, string> = {};
    for (const err of e.errors) mapped[err.path || "__form"] = err.message;
    if (Object.keys(mapped).length === 0) mapped.__form = e.message;
    serverErrors.value = mapped;
    return;
  }
  throw e;
}
</script>

<template>
  <div class="ticket-editor">
    <p v-if="loading" class="ticket-loading">Loading…</p>
    <p v-if="notice" class="ticket-notice">{{ notice }}</p>
    <!-- No `v-if` gate: the form may mount before the row lands. -->
    <AsForm
      ref="asForm"
      :def="def"
      :form-data="formData"
      :types="types"
      :errors="serverErrors"
      track-changes
      @submit="onSubmit"
    />
  </div>
</template>
```

## 3. The custom control

`TicketPriority.vue` — the component behind `@ui.type 'priority'`. It receives
the whole resolved field state as props (`TAsComponentProps<T>`), including the
`options` that `@atscript/ui` already derived from the literal union, so the
control owns the **look** only, never the option list.

```vue
<script setup lang="ts">
import { optKey, optLabel } from "@atscript/ui";
import { AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps<string>>();

function pick(next: string): void {
  props.model.value = next;
  props.onBlur();
}
</script>

<template>
  <AsFieldShell v-bind="$props" field-class="ticket-priority">
    <template #default="{ inputId }">
      <div
        :id="inputId"
        class="ticket-priority-group"
        role="group"
        :aria-describedby="ariaDescribedBy"
      >
        <button
          v-for="opt in options"
          :key="optKey(opt)"
          type="button"
          class="ticket-priority-option"
          :name="name"
          :value="optKey(opt)"
          :disabled="disabled"
          :aria-pressed="model.value === optKey(opt)"
          @click="pick(optKey(opt))"
        >
          {{ optLabel(opt) }}
        </button>
      </div>
    </template>
  </AsFieldShell>
</template>
```

Wrapping `AsFieldShell` inherits label, description, error, dirty marker and
`aria-describedby` wiring. See [Custom components](/forms/custom-components)
for the full contract.

## What the example proves

Each bullet is an assertion in the accompanying spec, not a claim.

### The form-data contract

`createAsFormDef(type)` returns `{ def, formData }`, and `formData` is the
**wrapped** container `{ value: domainData }` — that is what `:form-data`
expects. `@submit` goes the other way and hands you the **unwrapped** domain
data. See [Hello World](/forms/hello-world#how-the-three-pieces-line-up).

### Fill the container whenever you like

The example mounts `<AsForm>` immediately and assigns the row into `formData`
when the fetch resolves — no `v-if` gate. Since 0.1.134 replacing the
container's `.value` on a **clean** form re-baselines the change tracker onto
the new value, so the form is not born dirty against the defaults
`createAsFormDef` seeded, and the first `getPatch()` is a real diff rather than
the whole row.

The explicit `rebase()` is still the answer for a **dirty** swap: if the user
has unsaved edits, assigning a new row keeps the old baseline (dropping their
work silently would be the wrong default), so call `asForm.value!.rebase()`
yourself — or `rebaseOnto()` to keep the edits on top of the new row.

### An unchanged submit sends nothing

`getPatch()` returns `{}` when nothing changed — and because it is empty it
carries **no `$cas` either**, so there is nothing to mistake for a write. The
example returns before touching the client, and the spec asserts the client was
never called. That's the whole reason to submit a patch rather than the
`@submit` payload: a full-object write would have re-sent every field.

### A changed submit sends the diff plus `$cas`

One edited field produces `{ subject: "…", $cas: { version: 3 } }` — no other
field, and never `version` as a normal column (it is server-managed). After the
write, `rebase()` makes the form clean again without a remount, so an immediate
second submit sends nothing.

### Version mismatch is recoverable

A stale write rejects with `VersionMismatchError`. Reload the row and
`rebaseOnto({ value: fresh }, { conflict: "ours" })`: untouched fields adopt
the server's values, the user's edits survive, `conflicts` names the paths that
diverged, and the new baseline carries the fresh version — so the retry lifts
`$cas: { version: 4 }` automatically. Details in
[Change tracking](/forms/change-tracking#folding-in-fresh-server-data-rebaseonto).

### Server field errors land on the fields

`ClientError.errors` is the structured envelope
(`{ path, message, details? }[]`) from a 400. Map it to
`Record<path, message>` and hand it to `:errors`; an entry with no path belongs
under `__form`, which renders the form-level banner. The errors auto-dismiss as
the user edits the offending field — see
[Validation](/forms/validation#external-errors).

## Next steps

- [Change tracking](/forms/change-tracking) — the full patch / rebase / `$cas`
  reference.
- [Validation](/forms/validation) — local rules and the external-error
  lifecycle.
- [Custom components](/forms/custom-components) — the `TAsComponentProps`
  contract in full.
- [References (FK)](/forms/references) — value-help pickers for foreign keys.
