<script setup lang="ts">
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { Product } from "./product.as";

const { def, formData } = createAsFormDef(Product);
const saved: Product[] = [];
</script>

<template>
  <!-- An inline handler sees the model: `p.name` with no container hop. -->
  <AsForm
    :def="def"
    :form-data="formData"
    :types="createDefaultTypes()"
    @submit="(p) => saved.push({ ...p, name: p.name.trim() })"
  />
  <!-- …and is not `any`: an unknown key is an error. -->
  <!-- @vue-expect-error `nope` is not a field of Product -->
  <AsForm :def="def" :form-data="formData" :types="createDefaultTypes()" @submit="(p) => p.nope" />
</template>
