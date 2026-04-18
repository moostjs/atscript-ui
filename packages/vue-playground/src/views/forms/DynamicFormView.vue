<script setup lang="ts">
import { inject } from "vue";
import { AsForm, createDefaultTypes, useForm } from "@atscript/vue-form";
import { DynamicForm } from "../../forms/dynamic-form.as";

const showToast = inject<(msg: string) => void>("showToast")!;
const types = createDefaultTypes();

const context = {
  labels: { contextLabel: "Custom Context Label" },
  descriptions: { contextDescription: "This label and description come from context" },
};

const { def, formData } = useForm(DynamicForm, context);

function onSubmit(data: unknown) {
  console.log("DynamicForm submitted:", data);
  showToast("Form submitted successfully");
}
</script>

<template>
  <div class="view-layout">
    <div class="view-form">
      <div class="view-form-inner">
        <div class="view-eyebrow">atscript-ui · Workflows</div>
        <h2>Dynamic (ui.fn.*)</h2>
        <p class="view-intro">
          Computed labels, hidden state, disabled state and options — all driven from
          <code>@ui.fn.*</code> expressions over form data and context.
        </p>
        <AsForm
          :def="def"
          :form-data="formData"
          :form-context="context"
          :types="types"
          @submit="onSubmit"
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
