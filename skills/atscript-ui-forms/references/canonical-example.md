# canonical-example

ONE complete edit form wired to a db client: compiled `.as` type →
`createAsFormDef` → `<AsForm track-changes>` → `getPatch()` PATCH with `$cas`,
`VersionMismatchError` recovery via `rebaseOnto()`, a 400 validation envelope
mapped onto fields, and one custom control registered through `types`. Copy this
when asked "wire a form to the db client", "OCC form example", or "show server
field errors on the fields".

The component below is kept verbatim in
`packages/vue-form/src/__tests__/fixtures/canonical-form.vue` and is mounted by
`canonical-form.spec.ts` — every claim here is an assertion there.

## Contents

- [The type](#the-type)
- [The component](#the-component)
- [The custom control](#the-custom-control)
- [Invariants](#invariants)
- [See also](#see-also)

## The type

```atscript
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

## The component

```vue
<script setup lang="ts">
import { ref, watch } from "vue";
import { ClientError, VersionMismatchError, type Client } from "@atscript/db-client";
import type { FormFieldChange, FormRebaseOptions } from "@atscript/ui";
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { ServiceTicket } from "../forms/ServiceTicket.as";
import TicketPriority from "./TicketPriority.vue";

const props = defineProps<{ id: number; client: Client<typeof ServiceTicket> }>();

// One custom control; everything else keeps its default renderer.
const types = { ...createDefaultTypes(), priority: TicketPriority };
// `formData` is the WRAPPED container `{ value: domainData }`.
const { def, formData } = createAsFormDef(ServiceTicket);

// `AsForm` is generic — a structural handle types the ref more cleanly than
// `InstanceType<typeof AsForm>`.
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
const serverErrors = ref<Record<string, string>>({});
const notice = ref("");

async function load(): Promise<void> {
  loading.value = true;
  try {
    const row = await props.client.one({ id: props.id });
    // Fill the SAME container whenever you like — a CLEAN swap re-baselines
    // the tracker onto the loaded row (since 0.1.134), no `v-if` gate needed.
    if (row) formData.value = row;
  } finally {
    loading.value = false;
  }
}
watch(() => props.id, load, { immediate: true });

async function onSubmit(): Promise<void> {
  const patch = asForm.value!.getPatch(); // minimal diff + `$cas`
  if (Object.keys(patch).length === 0) {
    notice.value = "No changes"; // nothing changed ⇒ NO request at all
    return;
  }
  serverErrors.value = {};
  notice.value = "";
  try {
    // getPatch() is a runtime diff — cast at the typed client boundary.
    await props.client.update({ id: props.id, ...patch } as never);
    asForm.value!.rebase(); // clean again, no remount
    notice.value = "Saved";
  } catch (e) {
    await onSubmitFailed(e);
  }
}

async function onSubmitFailed(e: unknown): Promise<void> {
  if (e instanceof VersionMismatchError) {
    // Somebody wrote first: reload and fold upstream UNDER the local edits.
    const fresh = await props.client.one({ id: props.id });
    const { conflicts } = asForm.value!.rebaseOnto({ value: fresh }, { conflict: "ours" });
    notice.value = conflicts.length
      ? `Row changed on the server — kept your edits to: ${conflicts.join(", ")}`
      : "Row changed on the server — your edits were merged in";
    return;
  }
  if (e instanceof ClientError) {
    // 400 envelope: { message, statusCode, errors: [{ path, message }] }
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
    <p v-if="loading">Loading…</p>
    <p v-if="notice">{{ notice }}</p>
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

## The custom control

`@ui.type` is open-ended: any string you also register in `types`. The control
receives the resolved field state (`TAsComponentProps<T>`) including the
`options` derived from the literal union — it owns the look only.

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
      <div :id="inputId" role="group" :aria-describedby="ariaDescribedBy">
        <button
          v-for="opt in options"
          :key="optKey(opt)"
          type="button"
          class="ticket-priority-option"
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

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `createAsFormDef(type)` → `{ def, formData }`; `formData` is `{ value: domainData }` (what `:form-data` expects). `@submit` emits the **unwrapped** domain data.                                                                                                                                                       |
| 2   | Fill the container whenever you like: replacing `formData.value` on a CLEAN form re-baselines the tracker onto the new value (since 0.1.134), so a form mounted before the row lands is not born dirty. A DIRTY swap keeps the old baseline — call `rebase()` (drop the edits) or `rebaseOnto()` (keep them) yourself. |
| 3   | An unchanged submit yields `getPatch() === {}` — and an empty patch carries **no `$cas`**. Return before calling the client: send nothing.                                                                                                                                                                             |
| 4   | A changed submit sends only the diff plus `$cas: { version }`; the `@db.column.version` column is never sent as a normal field. `rebase()` after the write, or the next submit re-sends the same patch.                                                                                                                |
| 5   | `VersionMismatchError` (409) → reload + `rebaseOnto({ value: fresh }, { conflict: 'ours' })`: local edits survive, `conflicts` lists diverged paths, and the retry lifts the FRESH `$cas` automatically.                                                                                                               |
| 6   | `ClientError.errors` is `{ path, message, details? }[]`. Map to `Record<path, message>` for `:errors`; a pathless entry goes under `__form` (the banner). External errors auto-dismiss on edit.                                                                                                                        |

## See also

- [form-change-tracking.md](form-change-tracking.md) — the full patch / dirty /
  rebase surface.
- [customization.md](customization.md) — `TAsComponentProps` and the override
  tiers.
- [forms.md](forms.md) — validation and the external-error lifecycle.
- Docs: https://ui.atscript.dev/forms/canonical-example
