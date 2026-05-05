<script setup lang="ts">
import { ref } from "vue";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import AsCellJsonBody from "./as-cell-json-body.vue";

defineProps<{ value: unknown }>();
const open = ref(false);
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="as-cell-json-popup"
        align="start"
        :side-offset="4"
        :collision-padding="8"
      >
        <AsCellJsonBody :value="value" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
