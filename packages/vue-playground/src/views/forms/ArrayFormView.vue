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
  <div class="view-layout">
    <div class="view-form">
      <div class="view-form-inner">
        <div class="view-eyebrow">atscript-ui · Forms</div>
        <h2>Arrays</h2>
        <p class="view-intro">
          Arrays of scalars and of structs with per-item remove buttons and "add" actions.
        </p>
        <AsForm
          :def="def"
          :form-data="formData"
          :types="types"
          @submit="onSubmit"
          @action="onAction"
        />
      </div>
    </div>
    <div class="form-debug">
      <div class="form-debug-card">
        <div class="form-debug-label">Form Data</div>
        {{ JSON.stringify(formData, null, 2) }}
      </div>
    </div>
  </div>
</template>
