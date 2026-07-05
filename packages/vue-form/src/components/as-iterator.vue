<script setup lang="ts">
import { joinPath, type FormDef, type FormFieldDef } from "@atscript/ui";
import { computed, inject, provide } from "vue";
import { PATH_PREFIX_KEY } from "../composables/internal-keys";
import { provideAsNestedLevel } from "../composables/use-as-level";
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
  /**
   * Bump the nesting level for rendered children RELATIVE to the injected
   * parent level (sugar over `provideAsNestedLevel`). For custom container
   * panes standing in for a structured field's section chrome. Setup-time /
   * non-reactive — an identity of the pane, like `pathPrefix`.
   */
  levels?: number;
}>();

// Path prefix management
const parentPrefix = inject(
  PATH_PREFIX_KEY,
  computed(() => ""),
);
const myPrefix = computed(() => {
  if (props.pathPrefix !== undefined) {
    return joinPath(parentPrefix.value, props.pathPrefix);
  }
  return parentPrefix.value;
});
provide(PATH_PREFIX_KEY, myPrefix);

if (props.levels !== undefined) provideAsNestedLevel(props.levels);
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
