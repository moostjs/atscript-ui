<script setup lang="ts">
import { inject } from "vue";
import { AsForm, createDefaultTypes, useForm } from "@atscript/vue-form";
import { BasicForm } from "../forms/basic-form.as";

const showToast = inject<(msg: string) => void>("showToast")!;
const types = createDefaultTypes();
const { def, formData } = useForm(BasicForm);

function onSubmit(data: unknown) {
  console.log("BasicForm submitted:", data);
  showToast("Form submitted successfully");
}
</script>

<template>
  <h2>Basic Fields</h2>
  <div class="view-layout">
    <div class="view-form">
      <AsForm :def="def" :form-data="formData" :types="types" @submit="onSubmit" />
    </div>
    <div class="form-debug">
      <div class="form-debug-label">Form Data</div>
      {{ JSON.stringify(formData, null, 2) }}
    </div>
  </div>
</template>
