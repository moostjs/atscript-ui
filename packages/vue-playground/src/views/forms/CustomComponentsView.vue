<script setup lang="ts">
import { inject } from "vue";
import { AsForm, createDefaultTypes, useForm } from "@atscript/vue-form";
import type { TAsTypeComponents } from "@atscript/vue-form";
import { SelectRadioForm } from "../../forms/select-radio-form.as";
import MyStarInput from "../../custom-components/MyStarInput.vue";
import MySelect from "../../custom-components/MySelect.vue";
import MyRadio from "../../custom-components/MyRadio.vue";
import MyCheckbox from "../../custom-components/MyCheckbox.vue";
import MyParagraph from "../../custom-components/MyParagraph.vue";
import MyActionButton from "../../custom-components/MyActionButton.vue";
import MyGroup from "../../custom-components/MyGroup.vue";

const showToast = inject<(msg: string) => void>("showToast")!;
const types: TAsTypeComponents = {
  ...createDefaultTypes(),
  text: MyStarInput,
  password: MyStarInput,
  number: MyStarInput,
  select: MySelect,
  radio: MyRadio,
  checkbox: MyCheckbox,
  paragraph: MyParagraph,
  action: MyActionButton,
  object: MyGroup,
};

const context = {
  cityOptions: [
    { label: "New York", key: "nyc" },
    { label: "Los Angeles", key: "la" },
    { label: "Chicago", key: "chi" },
  ],
};

const { def, formData } = useForm(SelectRadioForm, context);

function onSubmit(data: unknown) {
  console.log("CustomComponents submitted:", data);
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
    showToast("Selections reset");
  }
}
</script>

<template>
  <div class="view-layout">
    <div class="view-form">
      <div class="view-form-inner">
        <div class="view-eyebrow">atscript-ui · Workflows</div>
        <h2>Custom Components (BYOUI)</h2>
        <p class="view-intro">
          All field types overridden with custom components: star input, pill radio, toggle
          checkbox, styled select, gradient paragraph, lightning action button, and purple group.
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
