<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";
import { useAsTexts, useUiLocaleKey } from "@atscript/vue-form/locale";
import AsFilterFieldBody from "../internal/as-filter-field-body.vue";

defineProps<{
  column: ColumnDef;
}>();

// The body is rebuilt per UI locale (its key): its dictionary, distinct values
// and texts follow a switch — of `provideAsLocale` or of `setUiLocale`.
const locale = useUiLocaleKey(useAsTexts());
</script>

<template>
  <AsFilterFieldBody :key="locale ?? ''" :column="column" />
</template>
