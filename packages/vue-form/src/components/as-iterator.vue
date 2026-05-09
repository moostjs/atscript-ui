<script setup lang="ts">
import type { FormDef } from "@atscript/ui";
import { computed, inject, provide } from "vue";
import { PATH_PREFIX_KEY } from "../composables/internal-keys";
import AsField from "./as-field.vue";

const props = defineProps<{
  def: FormDef;
  pathPrefix?: string;
  onRemove?: () => void;
  canRemove?: boolean;
  removeLabel?: string;
}>();

// Path prefix management
const parentPrefix = inject(
  PATH_PREFIX_KEY,
  computed(() => ""),
);
const myPrefix = computed(() => {
  if (props.pathPrefix !== undefined) {
    return parentPrefix.value ? `${parentPrefix.value}.${props.pathPrefix}` : props.pathPrefix;
  }
  return parentPrefix.value;
});
provide(PATH_PREFIX_KEY, myPrefix);
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
