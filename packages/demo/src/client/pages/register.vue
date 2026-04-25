<script setup lang="ts">
import { useRouter } from "vue-router";
import { AsWfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../types/demo-types";
import { useMe } from "../api/use-me";

const router = useRouter();
const { refresh } = useMe();
const types = createDemoTypes();

async function onFinished() {
  await refresh();
  void router.push("/");
}
</script>

<template>
  <div class="min-h-screen grid place-items-center layer-1">
    <div class="flex flex-col gap-$s min-w-[360px] p-$l layer-0 border-1 rounded-r2 shadow-popup">
      <div class="flex flex-col items-center gap-$xs mb-$s">
        <img src="/logo.svg" alt="AtShop" class="w-12 h-12" />
        <h1 class="text-lg font-700 m-0">AtShop — Register</h1>
        <p
          class="scope-grey font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0"
        >
          atscript-ui demo
        </p>
      </div>
      <AsWfForm
        path="/api/wf"
        name="api/auth/register"
        :types="types"
        first-validation="on-submit"
        @finished="onFinished"
      >
        <template #wf.loading>
          <div class="p-4 text-sm opacity-60">Loading…</div>
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
            {{ loading ? "Submitting…" : (text ?? "Submit") }}
          </button>
        </template>
      </AsWfForm>
      <p class="text-callout text-current/60 m-0">
        Already have an account?
        <RouterLink to="/login" class="scope-primary text-current-hl underline">Sign in</RouterLink>
      </p>
    </div>
  </div>
</template>
