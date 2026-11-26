<script setup lang="ts">
import { ref } from "vue";
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import { VariantPickerForm } from "./schemas/value-help.as";
import DarkToggle from "./_dark-toggle.vue";

const { def, formData } = createAsFormDef(VariantPickerForm);
formData.value = { attribute: "size" };
const types = createDefaultTypes();

// Every committed edit, in order — a pick commits its field and each field it fills.
const changes = ref<string[]>([]);
function onChange(type: string, path: string) {
  changes.value.push(`${type}:${path}`);
}

function onSubmit(data: unknown) {
  console.log("VariantPickerForm submitted:", data);
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
        <h1 class="text-h3 m-0">Value help</h1>
        <p class="text-callout text-current-muted m-0 mt-$xxs">
          A picker narrowed by another field of the form, picks that fill other fields, and a
          dropdown listing a small dictionary.
        </p>
        <RouterLink
          to="/forms-demo"
          class="text-callout text-current/60 underline mt-$xs self-start"
        >
          ← back to forms hub
        </RouterLink>
      </header>

      <AsForm
        data-testid="value-help-form"
        :def="def"
        :form-data="formData"
        :types="types"
        hide-root-title
        first-validation="on-submit"
        @change="onChange"
        @submit="onSubmit"
      >
      </AsForm>

      <details open class="mt-$l layer-0 border-1 rounded-r2 p-$m text-callout">
        <summary class="cursor-pointer font-600 text-current-muted">Form data preview</summary>
        <pre data-testid="value-help-preview" class="mt-$s overflow-auto text-callout">{{
          JSON.stringify(formData, null, 2)
        }}</pre>
        <pre data-testid="value-help-changes" class="mt-$s overflow-auto text-callout">{{
          changes.join("\n")
        }}</pre>
      </details>
    </div>
  </div>
</template>
