<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { AsForm } from "@atscript/vue-form";
import { createFormDef, type FormDef } from "@atscript/ui";
import { deserializeAnnotatedType } from "@atscript/typescript/utils";
import { clientForTable } from "../api/client-factory";
import { createDemoTypes } from "../types/demo-types";
import { useMe } from "../api/use-me";

const props = defineProps<{ tablePath: string; id: string | number }>();

const router = useRouter();
const { me } = useMe();

const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const error = ref<string | null>(null);
const savedAt = ref<number | null>(null);
const formDef = ref<FormDef | null>(null);
const record = ref<Record<string, unknown> | null>(null);
const types = createDemoTypes();

const client = computed(() => clientForTable(props.tablePath));
const canWrite = computed(() => !!me.value?.permissions?.[props.tablePath]?.write);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [meta, row] = await Promise.all([
      client.value.meta(),
      client.value.one(props.id as never),
    ]);
    formDef.value = createFormDef(deserializeAnnotatedType(meta.type));
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

async function onDelete() {
  if (!window.confirm(`Delete ${props.tablePath} #${props.id}? This cannot be undone.`)) {
    return;
  }
  deleting.value = true;
  error.value = null;
  try {
    await client.value.remove(props.id as never);
    void router.push(`/${props.tablePath}`);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="as-page-narrow">
      <div class="as-page-eyebrow">atscript-ui demo · {{ tablePath }}</div>
      <header class="as-page-header">
        <h1 class="as-page-title flex-1">Edit {{ tablePath }} #{{ id }}</h1>
        <span v-if="saving" class="text-callout text-current/60">saving…</span>
        <span v-else-if="savedAt" class="text-callout scope-good text-current-hl">saved</span>
        <button
          v-if="canWrite && !loading && record"
          type="button"
          :disabled="deleting"
          class="c8-flat scope-error inline-flex items-center gap-$s h-fingertip-m px-$m border-1 rounded-base font-600 cursor-pointer disabled:opacity-50"
          @click="onDelete"
        >
          <span class="i-ph:trash" aria-hidden="true" />
          <span>{{ deleting ? "Deleting…" : "Delete" }}</span>
        </button>
      </header>

      <p v-if="loading" class="text-current/60">Loading…</p>
      <p v-else-if="error" class="scope-error text-current-hl">Error: {{ error }}</p>
      <AsForm
        v-else-if="formDef && record"
        :def="formDef"
        :form-data="{ value: record }"
        :types="types"
        @submit="onSubmit"
      />
    </div>
  </div>
</template>
