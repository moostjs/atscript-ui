<script setup lang="ts">
import { inject } from "vue";
import { AsForm, createDefaultTypes, useForm } from "@atscript/vue-form";
import { ArrayForm } from "../../forms/array-form.as";

const showToast = inject<(msg: string) => void>("showToast")!;
const types = createDefaultTypes();
const { def, formData } = useForm(ArrayForm);

function onSubmit(data: unknown) {
  console.log("ArrayForm submitted:", data);
  showToast("Form submitted successfully");
}

function onAction(action: string) {
  if (action === "clear-arrays") {
    formData.value.tags = [];
    formData.value.scores = [];
    formData.value.addresses = [];
    formData.value.contacts = [];
  }
}
</script>

<template>
  <h2>Arrays</h2>
  <div class="view-layout">
    <div class="view-form">
      <AsForm
        :def="def"
        :form-data="formData"
        :types="types"
        @submit="onSubmit"
        @action="onAction"
      />
    </div>
    <div class="form-debug">
      <div class="form-debug-label">Form Data</div>
      {{ JSON.stringify(formData, null, 2) }}
    </div>
  </div>
</template>
