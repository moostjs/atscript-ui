<script setup lang="ts">
import { ref } from "vue";
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import { AsRefPicker, AsTable, AsTableRoot } from "@atscript/vue-table";
import { OfficePickerForm, VariantPickerForm } from "./schemas/value-help.as";
import DarkToggle from "./_dark-toggle.vue";
import OfficesExport from "./_offices-export.vue";
import { useMe } from "../../api/use-me";

const { def, formData } = createAsFormDef(VariantPickerForm);
formData.value = { attribute: "size" };
const types = createDefaultTypes();

// A reference field with a picker dialog (`AsRefPicker` for the `ref` type).
const office = createAsFormDef(OfficePickerForm);
office.formData.value = {
  country: "DE",
  city: "MUC",
  cityName: "Munich",
  headOffice: "BER",
  headOfficeName: "Berlin",
};
const officeTypes = { ...createDefaultTypes(), ref: AsRefPicker };
// Like `TablePage`: the table mounts once the signed-in user is known (client only).
const { loaded } = useMe();

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

      <h2 class="text-h4 m-0 mt-$l">Picker dialog and codes with their text</h2>
      <p class="text-callout text-current-muted m-0">
        The city opens a dialog listing the country's cities; the city and the head office read as a
        code with its name.
      </p>
      <AsForm
        data-testid="value-help-dialog-form"
        :def="office.def"
        :form-data="office.formData"
        :types="officeTypes"
        hide-root-title
        first-validation="on-submit"
      >
      </AsForm>
      <pre
        data-testid="value-help-dialog-preview"
        class="layer-0 border-1 rounded-r2 p-$m text-callout overflow-auto"
        >{{ JSON.stringify(office.formData, null, 2) }}</pre
      >

      <h2 class="text-h4 m-0 mt-$l">Offices</h2>
      <section data-testid="offices-table" class="flex flex-col gap-$s h-[18em] min-h-0">
        <AsTableRoot
          v-if="loaded"
          url="/api/db/tables/offices"
          :limit="10"
          class="flex-1 flex flex-col min-h-0"
        >
          <AsTable class="flex-1 min-h-0" />
          <OfficesExport />
        </AsTableRoot>
      </section>
    </div>
  </div>
</template>
