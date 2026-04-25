<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { AsWfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../types/demo-types";
import { useMe } from "../api/use-me";

const route = useRoute();
const router = useRouter();
const token = computed(() => String(route.params.token));
const types = createDemoTypes();
const { refresh } = useMe();

async function onFinished() {
  await refresh();
  void router.push("/");
}
function onError(e: { status?: number; message?: string }) {
  if (e?.status === 410) {
    alert("Invite link has expired. Ask an admin for a new one.");
  }
}
</script>

<template>
  <div class="min-h-screen grid place-items-center layer-1">
    <div class="flex flex-col gap-$s min-w-[360px] p-$l layer-0 border-1 rounded-r2 shadow-popup">
      <div class="flex flex-col items-center gap-$xs mb-$s">
        <img src="/logo.svg" alt="AtShop" class="w-12 h-12" />
        <h1 class="text-lg font-700 m-0">Accept invitation</h1>
        <p
          class="scope-grey font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0"
        >
          atscript-ui demo
        </p>
      </div>
      <AsWfForm
        path="/api/wf"
        name="api/users/invite"
        :initial-token="token"
        :types="types"
        first-validation="on-submit"
        @finished="onFinished"
        @error="onError"
      >
        <template #wf.loading>
          <div class="p-4 text-sm opacity-60">Loading invite…</div>
        </template>
        <template #wf.error="{ error, retry }">
          <div class="p-4 text-red-600 text-sm">
            <p>{{ (error as any)?.message ?? "Error" }}</p>
            <button class="mt-2 underline" @click="retry">Retry</button>
          </div>
        </template>
        <template #form.submit="{ disabled, loading, text }">
          <button
            type="submit"
            :disabled="disabled || loading"
            class="c8-filled scope-primary h-fingertip-m px-$m rounded-base font-600 disabled:opacity-50"
          >
            {{ loading ? "Accepting…" : (text ?? "Accept & sign in") }}
          </button>
        </template>
      </AsWfForm>
    </div>
  </div>
</template>
