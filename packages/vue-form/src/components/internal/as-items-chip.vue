<script setup lang="ts">
import { useAsTexts } from "../../composables/use-as-locale";

defineProps<{ count: number }>();
const { t } = useAsTexts();
</script>

<template>
  <span class="as-array-items-chip">{{ t("UI_FORM_ITEMS_COUNT", { count }) }}</span>
</template>
