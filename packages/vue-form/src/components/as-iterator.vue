<script setup lang="ts">
import type { FormDef } from "@atscript/ui-core";
import { computed, inject, provide, type ComputedRef } from "vue";
import AsField from "./as-field.vue";

const props = defineProps<{
  def: FormDef;
  pathPrefix?: string;
  onRemove?: () => void;
  canRemove?: boolean;
  removeLabel?: string;
}>();

// Path prefix management
const parentPrefix = inject<ComputedRef<string>>(
  "__as_path_prefix",
  computed(() => ""),
);
const myPrefix = computed(() => {
  if (props.pathPrefix !== undefined) {
    return parentPrefix.value ? `${parentPrefix.value}.${props.pathPrefix}` : props.pathPrefix;
  }
  return parentPrefix.value;
});
provide("__as_path_prefix", myPrefix);
</script>

<template>
  <AsField
    v-for="f of def.fields"
    :key="f.path ?? f.name"
    :field="f"
    :on-remove="onRemove"
    :can-remove="canRemove"
    :remove-label="removeLabel"
  />
</template>
