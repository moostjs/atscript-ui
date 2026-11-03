<script setup lang="ts">
// The documented form flow, typed end to end from a generated model.
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { Product } from "./product.as";

const { def, formData } = createAsFormDef(Product);
const types = createDefaultTypes();

// `formData` is the `{ value }` container of the model.
const name: string = formData.value.name;
formData.value.price = 1;
// …and is not `any`: an unknown key is an error.
// @ts-expect-error `nope` is not a field of Product
void formData.value.nope;

// Handlers receive the model itself, not the container.
function save(product: Product): void {
  void product.name;
}
function onAction(action: string, product: Product): void {
  void action;
  void product.id;
}
function onChange(type: string, path: string, value: unknown, product: Product): void {
  void [type, path, value, product.price];
}
</script>

<template>
  <AsForm
    :def="def"
    :form-data="formData"
    :types="types"
    @submit="save"
    @action="onAction"
    @unsupported-action="onAction"
    @change="onChange"
  >
    <!-- Slots get the container (`data.value` is the model). -->
    <template #form.footer="{ data }">
      <span>{{ name }} {{ data.value.name.length }}</span>
    </template>
  </AsForm>
</template>
