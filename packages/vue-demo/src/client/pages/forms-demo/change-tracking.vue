<script setup lang="ts">
import { ref, computed } from "vue";
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import type { FormFieldChange } from "@atscript/ui";
import { ChangeTrackingOrder } from "./schemas/change-tracking.as";
import DarkToggle from "./_dark-toggle.vue";

const { def, formData } = createAsFormDef(ChangeTrackingOrder);
const types = createDefaultTypes();

// Seed a pre-loaded order record. `formData` is the wrapped `{ value }`
// container; assigning `.value` before <AsForm> mounts means track-changes
// captures THIS as the baseline, so every edit produces a real diff.
formData.value = {
  reference: "ORD-2026-0042",
  status: "confirmed",
  priority: false,
  notes: "",
  address: {
    street: "1 Market St",
    city: "San Francisco",
    postcode: "94105",
  },
  items: [
    { sku: "SKU-001", description: "Standard widget", qty: 3 },
    { sku: "SKU-002", description: "Deluxe widget", qty: 1 },
  ],
  // Server-managed version column — getPatch() round-trips this through $cas
  // and never emits it as a normal SET.
  version: 7,
};

// Parent template ref → the <AsForm> defineExpose surface
// (submit / reset / isDirty / changes / getPatch / getChanges / rebase).
const asForm = ref<InstanceType<typeof AsForm> | null>(null);

// The patch snapshot we "persisted" on the last Save (for the echo panel).
const lastSaved = ref<Record<string, unknown> | null>(null);

// Live patch driven off the slot props (recomputed as the user edits) — see
// #form.footer below for the slot-prop variant. This computed mirrors it via
// the imperative ref so the right-hand JSON panel updates live too.
const livePatch = computed(() => {
  // Depend on the reactive `changes` array (not the latching `isDirty` boolean)
  // so this recomputes on EVERY edit — including edits to an already-dirty form
  // (e.g. filling a freshly-added line-item row). `isDirty` flips once and then
  // stays true, which would leave the panel stale after the first change.
  void asForm.value?.changes;
  return asForm.value?.getPatch() ?? {};
});

function onSave() {
  const patch = asForm.value?.getPatch();
  if (!patch || Object.keys(patch).length === 0) return;
  // In a real app: await table.updateOne(id, patch). Here we just echo it…
  lastSaved.value = patch;
  console.log("ChangeTrackingOrder save patch:", patch);
  // …then re-baseline so the form goes clean again without a remount.
  asForm.value?.rebase();
}

function onSubmit(data: unknown) {
  console.log("ChangeTrackingOrder submitted:", data);
  onSave();
}

const panelClass = "layer-0 border-1 rounded-r2 p-$m flex flex-col gap-$s";
const codeClass = "overflow-auto text-callout font-mono m-0 whitespace-pre-wrap";

function changeLabel(c: FormFieldChange) {
  return c.kind === "array" ? `array · ${c.path}` : `set · ${c.path}`;
}
</script>

<template>
  <div class="min-h-screen layer-1">
    <div class="max-w-5xl mx-auto p-$l flex flex-col gap-$l">
      <header class="flex flex-col gap-$xs">
        <div class="flex items-center justify-between gap-$s">
          <p
            class="font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0"
          >
            atscript-ui · forms demo
          </p>
          <DarkToggle />
        </div>
        <h1 class="text-h3 m-0">Change tracking · live patch</h1>
        <p class="text-callout text-current-muted m-0 mt-$xxs">
          A pre-loaded order edited with
          <code>&lt;AsForm track-changes&gt;</code>. Edit a scalar, the merge-strategy address, or a
          keyed line item (change a qty → <code>$update</code>, add a row → <code>$insert</code>,
          remove one → <code>$remove</code>) and watch the live <code>@atscript/db</code> patch on
          the right. The version column round-trips through <code>$cas</code> and is never emitted
          as a SET.
        </p>
        <RouterLink
          to="/forms-demo"
          class="text-callout text-current/60 underline mt-$xs self-start"
        >
          ← back to forms hub
        </RouterLink>
      </header>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-$l items-start">
        <!-- ── Left: the tracked form ──────────────────────── -->
        <AsForm
          ref="asForm"
          data-testid="change-tracking-form"
          :def="def"
          :form-data="formData"
          :types="types"
          track-changes
          hide-root-title
          hide-submit
          first-validation="on-submit"
          @submit="onSubmit"
        >
          <!-- Slot-prop variant: footer reads isDirty / changes straight off
               the slot binding (no template ref needed). -->
          <template #form.footer="{ isDirty, changes }">
            <div class="flex items-center gap-$m mt-$m">
              <button
                type="button"
                data-testid="save-btn"
                class="c8-filled scope-primary h-fingertip-m px-$l rounded-base font-600 disabled:opacity-50"
                :disabled="!isDirty"
                @click="onSave"
              >
                Save changes
              </button>
              <span
                data-testid="dirty-state"
                class="text-callout font-600"
                :class="isDirty ? 'scope-warn text-current-hl' : 'text-current-muted'"
              >
                {{ isDirty ? `${changes.length} unsaved change(s)` : "No unsaved changes" }}
              </span>
            </div>
          </template>
        </AsForm>

        <!-- ── Right: live diagnostics (template-ref variant) ── -->
        <div class="flex flex-col gap-$l sticky top-$l">
          <section :class="panelClass">
            <div class="flex items-center justify-between gap-$s">
              <h3 class="text-body-l font-600 m-0">Live patch · getPatch()</h3>
              <span
                class="font-mono text-[10px] uppercase tracking-wider px-$xs py-[2px] rounded-base"
                :class="
                  asForm?.isDirty
                    ? 'scope-warn text-current-hl bg-current/10'
                    : 'text-current/50 bg-current/5'
                "
              >
                {{ asForm?.isDirty ? "dirty" : "clean" }}
              </span>
            </div>
            <p class="text-callout text-current-muted m-0">
              The <code>@atscript/db</code> patch you would pass to
              <code>table.updateOne(id, patch)</code>.
            </p>
            <pre data-testid="live-patch" :class="codeClass">{{
              JSON.stringify(livePatch, null, 2)
            }}</pre>
          </section>

          <section :class="panelClass">
            <h3 class="text-body-l font-600 m-0">Changed fields · changes</h3>
            <p v-if="!asForm?.changes?.length" class="text-callout text-current-muted m-0">
              Nothing changed yet — edit a field on the left.
            </p>
            <ul v-else class="flex flex-col gap-$xs p-0 list-none m-0">
              <li
                v-for="c in asForm?.changes"
                :key="c.path"
                data-testid="change-row"
                class="flex flex-col gap-$xxs layer-1 border-1 rounded-base px-$s py-$xs"
              >
                <span class="font-mono text-callout font-600">{{ changeLabel(c) }}</span>
                <span class="font-mono text-[11px] text-current-muted overflow-auto">
                  {{ JSON.stringify(c.before) }} → {{ JSON.stringify(c.after) }}
                </span>
              </li>
            </ul>
          </section>

          <section v-if="lastSaved" :class="panelClass">
            <h3 class="text-body-l font-600 m-0">Last saved patch (echoed)</h3>
            <p class="text-callout text-current-muted m-0">
              Captured on Save, then <code>rebase()</code> cleared the dirty state.
            </p>
            <pre data-testid="last-saved" :class="codeClass">{{
              JSON.stringify(lastSaved, null, 2)
            }}</pre>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
