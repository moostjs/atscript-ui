<script setup lang="ts">
import { inject } from "vue";
import { AsForm, createDefaultTypes, useForm } from "@atscript/vue-form";
import { BasicForm } from "../../forms/basic-form.as";

const showToast = inject<(msg: string) => void>("showToast")!;
const types = createDefaultTypes();
const { def, formData } = useForm(BasicForm);

function onSubmit(data: unknown) {
  console.log("BasicForm submitted:", data);
  showToast("Form submitted successfully");
}
</script>

<template>
  <div class="view-layout">
    <div class="view-form">
      <div class="view-form-inner">
        <div class="view-eyebrow">atscript-ui · Forms</div>
        <h2>Basic Fields</h2>
        <p class="view-intro">
          Required, optional, disabled and read-only fields. Optional fields stay
          <code>undefined</code> until the user fills them in.
        </p>
        <AsForm :def="def" :form-data="formData" :types="types" @submit="onSubmit" />
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
