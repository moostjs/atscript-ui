<script setup lang="ts">
import type { TAsComponentProps } from "../types";

defineProps<TAsComponentProps>();
const emit = defineEmits<{
  (e: "action", name: string): void;
}>();
</script>

<template>
  <div class="as-default-field as-action-field" :class="$props.class" v-show="!hidden">
    <button type="button" @click="formAction && emit('action', formAction.id)">
      {{ formAction?.label }}
    </button>
  </div>
</template>
