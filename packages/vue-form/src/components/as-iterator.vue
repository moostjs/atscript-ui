<script setup lang="ts">
import type { FormDef, FormFieldDef } from "@atscript/ui";
import { computed, inject, provide } from "vue";
import { PATH_PREFIX_KEY } from "../composables/internal-keys";
import AsField from "./as-field.vue";

const props = defineProps<{
  def: FormDef;
  pathPrefix?: string;
  onRemove?: () => void;
  canRemove?: boolean;
  removeLabel?: string;
  /**
   * Explicit field list to render. Defaults to `def.fields`. Used to render a
   * precomputed partition of the same FormDef — `def.mainFields` (above submit)
   * vs `def.pushDownFields` (below submit) — so each field renders exactly once
   * across the two grids without re-scanning per frame.
   */
  fields?: FormFieldDef[];
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
    v-for="f of fields ?? def.fields"
    :key="f.path ?? f.name"
    :field="f"
    :on-remove="onRemove"
    :can-remove="canRemove"
    :remove-label="removeLabel"
  />
</template>
