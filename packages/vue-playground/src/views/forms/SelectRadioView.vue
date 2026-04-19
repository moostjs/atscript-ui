<script setup lang="ts">
import { inject } from "vue";
import { AsForm, createDefaultTypes, useForm } from "@atscript/vue-form";
import { SelectRadioForm } from "../../forms/select-radio-form.as";

const showToast = inject<(msg: string) => void>("showToast")!;
const types = createDefaultTypes();

const context = {
  cityOptions: [
    { label: "New York", key: "nyc" },
    { label: "Los Angeles", key: "la" },
    { label: "Chicago", key: "chi" },
    { label: "Houston", key: "hou" },
  ],
};

const { def, formData } = useForm(SelectRadioForm, context);

function onSubmit(data: unknown) {
  console.log("SelectRadioForm submitted:", data);
  showToast("Form submitted successfully");
}

function onAction(action: string) {
  if (action === "reset") {
    formData.value.country = undefined;
    formData.value.gender = undefined;
    formData.value.agreeToTerms = false;
    formData.value.favoriteColor = undefined;
    formData.value.priority = undefined;
    formData.value.city = undefined;
  }
}
</script>

<template>
  <div class="view-layout">
    <div class="view-form">
      <div class="view-form-inner">
        <div class="view-eyebrow">atscript-ui · Forms</div>
        <h2>Select / Radio</h2>
        <p class="view-intro">
          Enum-typed fields are rendered as dropdowns or radio groups depending on
          <code>@ui.component</code>.
        </p>
        <AsForm
          :def="def"
          :form-data="formData"
          :form-context="context"
          :types="types"
          @submit="onSubmit"
          @action="onAction"
        />
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
