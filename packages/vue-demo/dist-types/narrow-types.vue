<script setup lang="ts">
// A types map listing only the field kinds this form uses.
import { AsForm, AsInput, AsNumber, AsObject, createAsFormDef } from "@atscript/vue-form";
import { Product } from "./product.as";

const { def, formData } = createAsFormDef(Product);
</script>

<template>
  <AsForm
    :def="def"
    :form-data="formData"
    :types="{ object: AsObject, text: AsInput, number: AsNumber }"
  />
</template>
