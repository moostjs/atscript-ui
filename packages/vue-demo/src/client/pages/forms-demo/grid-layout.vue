<script setup lang="ts">
import { AsForm, createDefaultTypes, useForm } from "@atscript/vue-form";
import { GridLayoutForm } from "./schemas/grid-layout.as";

const { def, formData } = useForm(GridLayoutForm);
const types = createDefaultTypes();

function onSubmit(data: unknown) {
  console.log("GridLayoutForm submitted:", data);
}
</script>

<template>
  <div class="min-h-screen layer-1">
    <div class="max-w-2xl mx-auto p-$l flex flex-col gap-$l">
      <header class="flex flex-col gap-$xs">
        <p class="font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0">
          atscript-ui · forms demo
        </p>
        <h1 class="text-h3 m-0">Grid Layout</h1>
        <p class="text-callout text-current-muted m-0 mt-$xxs">
          Mixed col/row spans, aliases, two-arg responsive, and a nested grid that re-stacks below
          480px container width.
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
        <template #form.submit="{ disabled, text }">
          <div class="mt-$l flex justify-end">
            <button
              type="submit"
              :disabled="disabled"
              class="scope-primary c8-filled h-fingertip-m px-$l rounded-base font-600"
            >
              {{ text ?? "Save" }}
            </button>
          </div>
        </template>
      </AsForm>

      <details class="mt-$l layer-0 border-1 rounded-r2 p-$m text-callout">
        <summary class="cursor-pointer font-600 text-current-muted">Form data preview</summary>
        <pre class="mt-$s overflow-auto text-callout">{{ JSON.stringify(formData, null, 2) }}</pre>
      </details>
    </div>
  </div>
</template>
