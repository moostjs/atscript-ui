<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { AsForm } from "@atscript/vue-form";
import { clientForTable, valueHelpFactory } from "../api/client-factory";
import { createDemoTypes } from "../types/demo-types";

const props = defineProps<{ tablePath: string; id: string | number }>();

const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const savedAt = ref<number | null>(null);
const meta = ref<Record<string, unknown> | null>(null);
const record = ref<Record<string, unknown> | null>(null);
const types = createDemoTypes();

const client = computed(() => clientForTable(props.tablePath));

async function load() {
  loading.value = true;
  error.value = null;
  try {
    meta.value = (await client.value.meta()) as Record<string, unknown>;
    const row = await client.value.one(props.id as never);
    if (!row) throw new Error("Record not found");
    record.value = row as Record<string, unknown>;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

watch(() => [props.tablePath, props.id], load, { immediate: true });

async function onSubmit(data: unknown) {
  if (!record.value) return;
  saving.value = true;
  error.value = null;
  try {
    await client.value.update(data as never);
    savedAt.value = Date.now();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

const formDef = computed(() => (meta.value as { type?: unknown } | null)?.type);
</script>

<template>
  <div class="flex flex-col gap-4 p-6">
    <header class="flex items-center gap-3">
      <h1 class="text-lg font-semibold">Edit {{ tablePath }} #{{ id }}</h1>
      <span v-if="saving" class="text-sm opacity-70">saving…</span>
      <span v-else-if="savedAt" class="text-sm text-green-600">saved</span>
    </header>

    <p v-if="loading" class="opacity-70">Loading…</p>
    <p v-else-if="error" class="text-red-600">Error: {{ error }}</p>
    <AsForm
      v-else-if="formDef && record"
      :def="formDef"
      :form-data="{ value: record }"
      :types="types"
      :value-help-client-factory="valueHelpFactory"
      @submit="onSubmit"
    />
  </div>
</template>
