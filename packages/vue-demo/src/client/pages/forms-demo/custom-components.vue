<script setup lang="ts">
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import { BuiltinOverrideForm } from "./schemas/custom-components-builtin.as";
import { BuilderProfile } from "./schemas/custom-components-annotations.as";
import {
  DemoAddressCard,
  DemoColorSwatch,
  DemoContactCard,
  DemoGrowingTextarea,
  DemoNumberStepper,
  DemoRgbPicker,
  DemoStarRating,
  DemoTagInput,
} from "@/client/components/custom";
import DarkToggle from "./_dark-toggle.vue";

// ── Section A — built-in `text` override ─────────────────────────
// Replace the built-in `text` key in the types map with a custom
// growing textarea. Every string field on the form picks it up
// without touching the schema.
const { def: defA, formData: modelA } = createAsFormDef(BuiltinOverrideForm);
const typesA = {
  ...createDefaultTypes(),
  text: DemoGrowingTextarea,
};

// ── Section B — annotation-driven customizations ─────────────────
// Each field opts in via `@ui.form.type "<key>"` (or
// `@ui.form.component "<name>"` for the named-component path). Map
// keys must match the annotation values exactly. `displayName` has
// no annotation → falls back to the built-in `text` renderer.
const { def: defB, formData: modelB } = createAsFormDef(BuilderProfile);
const typesB = {
  ...createDefaultTypes(),
  bio: DemoGrowingTextarea,
  stars: DemoStarRating,
  "color-swatch": DemoColorSwatch,
  "tag-input": DemoTagInput,
  "address-card": DemoAddressCard,
  "rgb-picker": DemoRgbPicker,
  "contact-card": DemoContactCard,
};
const componentsB = {
  stepper: DemoNumberStepper,
};

function onSubmitA(data: unknown) {
  console.log("BuiltinOverrideForm submitted:", data);
}
function onSubmitB(data: unknown) {
  console.log("BuilderProfile submitted:", data);
}
</script>

<template>
  <div class="min-h-screen layer-1">
    <div class="max-w-2xl mx-auto p-$l flex flex-col gap-$xl">
      <header class="flex flex-col gap-$xs">
        <div class="flex items-center justify-between gap-$s">
          <p
            class="font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0"
          >
            atscript-ui · forms demo
          </p>
          <DarkToggle />
        </div>
        <h1 class="text-h3 m-0">Custom components</h1>
        <p class="text-callout text-current-muted m-0 mt-$xxs">
          Two complementary customization mechanisms: overriding a built-in field type globally via
          the <code>types</code> map (Section A), and per-field opt-in via
          <code>@ui.form.type</code> / <code>@ui.form.component</code> annotations (Section B).
        </p>
        <RouterLink
          to="/forms-demo"
          class="text-callout text-current/60 underline mt-$xs self-start"
        >
          ← back to forms hub
        </RouterLink>
      </header>

      <section class="flex flex-col gap-$m">
        <div class="flex flex-col gap-$xxs">
          <h2 class="text-h5 m-0">Section A — Built-in type override</h2>
          <p class="text-callout text-current-muted m-0">
            Both fields below have type <code>string</code>. The default <code>text</code> renderer
            (<code>AsInput</code>) is replaced with a custom <code>DemoGrowingTextarea</code> via a
            single <code>types</code>-map override — every string field on this form picks it up
            without touching the schema.
          </p>
        </div>
        <AsForm
          :def="defA"
          :form-data="modelA"
          :types="typesA"
          hide-root-title
          first-validation="on-submit"
          data-testid="custom-components-section-a-form"
          @submit="onSubmitA"
        />
        <details class="layer-0 border-1 rounded-r2 p-$m text-callout">
          <summary class="cursor-pointer font-600 text-current-muted">
            Section A · model preview
          </summary>
          <pre
            class="mt-$s overflow-auto text-callout"
            data-testid="custom-components-section-a-preview"
            >{{ JSON.stringify(modelA, null, 2) }}</pre
          >
        </details>
      </section>

      <section class="flex flex-col gap-$m">
        <div class="flex flex-col gap-$xxs">
          <h2 class="text-h5 m-0">Section B — Annotation-driven customizations</h2>
          <p class="text-callout text-current-muted m-0">
            Each annotated field opts into a per-field custom renderer via
            <code>@ui.form.type "&lt;key&gt;"</code> (or
            <code>@ui.form.component "&lt;name&gt;"</code> for the named-component path).
            <code>displayName</code> has no annotation, so it falls back to the built-in
            <code>text</code> renderer (<code>AsInput</code>) — that's the baseline-vs-custom
            comparison.
          </p>
        </div>
        <AsForm
          :def="defB"
          :form-data="modelB"
          :types="typesB"
          :components="componentsB"
          hide-root-title
          first-validation="on-submit"
          data-testid="custom-components-section-b-form"
          @submit="onSubmitB"
        />
        <details class="layer-0 border-1 rounded-r2 p-$m text-callout">
          <summary class="cursor-pointer font-600 text-current-muted">
            Section B · model preview
          </summary>
          <pre
            class="mt-$s overflow-auto text-callout"
            data-testid="custom-components-section-b-preview"
            >{{ JSON.stringify(modelB, null, 2) }}</pre
          >
        </details>
      </section>
    </div>
  </div>
</template>
