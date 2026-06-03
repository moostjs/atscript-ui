<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  AsForm,
  createDefaultTypes,
  provideAsNestedSectionsStore,
  createAsFormDef,
} from "@atscript/vue-form";
import { PrecisionCapture } from "./schemas/card-wrapped.as";
import DarkToggle from "./_dark-toggle.vue";

const { def, formData } = createAsFormDef(PrecisionCapture);
const types = createDefaultTypes();

// Provide the store at page level so AsForm picks it up and the sections start
// expanded — that way the "Audit" divider (and its full-bleed) is visible on load.
const sections = provideAsNestedSectionsStore();

// Controls whether --as-inset is set on the padded card wrapper. When ON, the
// form's root-level section dividers bleed to the card edges; when OFF they stop
// at the padded content box.
const bleed = ref(true);

// Child sections register in their own onMounted (which Vue runs before this
// parent hook), so every section is already registered by the time we expand.
onMounted(() => {
  sections.expandAll();
});

function onSubmit(data: unknown) {
  console.log("PrecisionCapture submitted:", data);
}
</script>

<template>
  <div class="min-h-screen layer-1">
    <div class="max-w-2xl mx-auto p-$l flex flex-col gap-$l">
      <header class="flex flex-col gap-$xs">
        <div class="flex items-center justify-between gap-$s">
          <p
            class="font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0"
          >
            atscript-ui · forms demo
          </p>
          <DarkToggle />
        </div>
        <h1 class="text-h3 m-0">Card-wrapped form</h1>
        <p class="text-callout text-current-muted m-0 mt-$xxs">
          A whole form wrapped in the consumer's own padded card. Root-level section dividers can
          full-bleed to the card edges via the <code>--as-inset</code> contract.
        </p>
        <RouterLink
          to="/forms-demo"
          class="text-callout text-current/60 underline mt-$xs self-start"
        >
          ← back to forms hub
        </RouterLink>
      </header>

      <div class="flex items-start gap-$m">
        <button
          type="button"
          data-testid="bleed-toggle"
          class="c8-flat h-fingertip-s px-$m rounded-base font-600 text-callout shrink-0"
          @click="bleed = !bleed"
        >
          {{ bleed ? "Full-bleed dividers: ON" : "Full-bleed dividers: OFF" }}
        </button>
        <p class="text-callout text-current-muted m-0">
          Toggling sets / unsets <code>--as-inset:1em</code> on the card. Watch the "Audit" divider
          snap to the card edges while "Sample ID" / "Operator" stay padded.
        </p>
      </div>

      <div class="layer-0 border-1 rounded-r2 p-$m" :class="bleed ? '[--as-inset:1em]' : ''">
        <AsForm
          data-testid="card-wrapped-form"
          :def="def"
          :form-data="formData"
          :types="types"
          hide-root-title
          first-validation="on-submit"
          @submit="onSubmit"
        />
      </div>

      <details class="mt-$l layer-0 border-1 rounded-r2 p-$m text-callout">
        <summary class="cursor-pointer font-600 text-current-muted">Form data preview</summary>
        <pre data-testid="card-wrapped-preview" class="mt-$s overflow-auto text-callout">{{
          JSON.stringify(formData, null, 2)
        }}</pre>
      </details>
    </div>
  </div>
</template>
