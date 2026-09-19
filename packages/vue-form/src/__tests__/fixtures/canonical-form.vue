<!--
  THE canonical form example. Kept here (and type-checked + mounted by
  `src/__tests__/canonical-form.spec.ts`) so the copy in
  `docs/forms/canonical-example.md` can never drift from something that runs.

  Covers, in one component:
    - a compiled `.as` import → `createAsFormDef(type)` → `{ def, formData }`,
      where `formData` is the WRAPPED container `{ value: domainData }`,
    - `createDefaultTypes()` plus ONE custom control registered by `@ui.type`,
    - change tracking → `getPatch()` (PATCH body) with the `$cas`
      optimistic-concurrency sibling, and "unchanged ⇒ no request at all",
    - fetch-then-fill: the row is assigned into the wrapped container after the
      form has mounted, and the clean swap re-baselines the tracker,
    - `VersionMismatchError` → reload + `rebaseOnto()` (keep local edits),
    - a server 400 validation envelope mapped onto fields via `:errors`.

  Only the imports differ from the documented version: inside the repo they
  point at the sources instead of `@atscript/vue-form`.
-->
<script setup lang="ts">
import { ref, watch } from "vue";
import { ClientError, VersionMismatchError, type Client } from "@atscript/db-client";
import type { FormFieldChange, FormRebaseOptions } from "@atscript/ui";
import AsForm from "../../components/as-form.vue";
import { createAsFormDef } from "../../composables/create-as-form-def";
import { createDefaultTypes } from "../../composables/create-default-types";
import { ServiceTicket } from "./canonical-ticket.as";
import TicketPriority from "./canonical-priority.vue";

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
    // dirty against the defaults `createAsFormDef` seeded. Only a swap on a
    // DIRTY form keeps the old baseline; that one needs an explicit
    // `rebase()` / `rebaseOnto()`.
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
