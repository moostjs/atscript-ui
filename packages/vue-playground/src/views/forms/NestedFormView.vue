<script setup lang="ts">
import { inject } from "vue";
import { AsForm, createDefaultTypes, useForm } from "@atscript/vue-form";
import { NestedForm } from "../../forms/nested-form.as";

const showToast = inject<(msg: string) => void>("showToast")!;
const types = createDefaultTypes();
const { def, formData } = useForm(NestedForm);

function onSubmit(data: unknown) {
  console.log("NestedForm submitted:", data);
  showToast("Form submitted successfully");
}
</script>

<template>
  <div class="view-layout">
    <div class="view-form">
      <div class="view-form-inner">
        <div class="view-eyebrow">atscript-ui · Forms</div>
        <h2>Nested Objects</h2>
        <p class="view-intro">
          Nested structs are rendered with indented rails so the shape of your data stays visible.
        </p>
        <AsForm :def="def" :form-data="formData" :types="types" @submit="onSubmit" />
      </div>
    </div>
    <div class="form-debug">
      <div class="form-debug-card rounded-base">
        <div class="form-debug-label">Form Data</div>
        {{ JSON.stringify(formData, null, 2) }}
      </div>
    </div>
  </div>
</template>
