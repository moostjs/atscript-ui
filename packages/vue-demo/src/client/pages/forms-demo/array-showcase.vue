<script setup lang="ts">
import { AsForm, createDefaultTypes, useForm } from "@atscript/vue-form";
import { ArrayShowcaseForm } from "./schemas/array-showcase.as";
import DarkToggle from "./_dark-toggle.vue";

const { def, formData } = useForm(ArrayShowcaseForm);
const types = createDefaultTypes();

function onSubmit(data: unknown) {
  console.log("ArrayShowcaseForm submitted:", data);
}
</script>

<template>
  <div class="min-h-screen layer-1">
    <div class="max-w-2xl mx-auto p-$l flex flex-col gap-$l">
      <header class="flex flex-col gap-$xs">
        <div class="flex items-center justify-between gap-$s">
          <p class="font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0">
            atscript-ui · forms demo
          </p>
          <DarkToggle />
        </div>
        <h1 class="text-h3 m-0">Array Showcase</h1>
        <p class="text-callout text-current-muted m-0 mt-$xxs">
          Optional and required arrays of primitives and objects, plus a nested array.
        </p>
        <RouterLink
          to="/forms-demo"
          class="text-callout text-current/60 underline mt-$xs self-start"
        >
          ← back to forms hub
        </RouterLink>
      </header>

      <AsForm
        :def="def"
        :form-data="formData"
        :types="types"
        hide-root-title
        first-validation="on-submit"
        @submit="onSubmit"
      >
      </AsForm>

      <details class="mt-$l layer-0 border-1 rounded-r2 p-$m text-callout">
        <summary class="cursor-pointer font-600 text-current-muted">Form data preview</summary>
        <pre class="mt-$s overflow-auto text-callout">{{ JSON.stringify(formData, null, 2) }}</pre>
      </details>
    </div>
  </div>
</template>
