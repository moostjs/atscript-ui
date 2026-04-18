<script setup lang="ts">
import { inject } from "vue";
import { AsForm, createDefaultTypes, useForm } from "@atscript/vue-form";
import { Client } from "@atscript/db-client";
import { OrderForm } from "../../forms/ref-form.as";

const showToast = inject<(msg: string) => void>("showToast")!;
const types = createDefaultTypes();
const { def, formData } = useForm(OrderForm);
const clientFactory = (url: string) => new Client(url);

function onSubmit(data: unknown) {
  console.log("OrderForm submitted:", data);
  showToast("Order created successfully");
}
</script>

<template>
  <div class="view-layout">
    <div class="view-form">
      <div class="view-form-inner">
        <div class="view-eyebrow">atscript-ui · Workflows</div>
        <h2>FK Ref (Value Help)</h2>
        <p class="view-intro">
          Form with FK reference fields that query the Products and Customers tables via value-help
          combobox.
        </p>
        <AsForm
          :def="def"
          :form-data="formData"
          :types="types"
          :value-help-client-factory="clientFactory"
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
