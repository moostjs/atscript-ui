<script setup lang="ts">
import { inject } from "vue";
import { AsForm, createDefaultTypes, useForm } from "@atscript/vue-form";
import { ValidationForm } from "../../forms/validation-form.as";

const showToast = inject<(msg: string) => void>("showToast")!;
const types = createDefaultTypes();
const { def, formData } = useForm(ValidationForm);

function onSubmit(data: unknown) {
  console.log("ValidationForm submitted:", data);
  showToast("Form submitted successfully");
}

function onError(errors: unknown) {
  console.log("ValidationForm errors:", errors);
}
</script>

<template>
  <h2>Validation</h2>
  <div class="view-layout">
    <div class="view-form">
      <AsForm :def="def" :form-data="formData" :types="types" @submit="onSubmit" @error="onError" />
    </div>
    <div class="form-debug">
      <div class="form-debug-label">Form Data</div>
      {{ JSON.stringify(formData, null, 2) }}
    </div>
  </div>
</template>
