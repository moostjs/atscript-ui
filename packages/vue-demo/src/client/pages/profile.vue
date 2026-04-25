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
  <div class="p-6 max-w-[520px]">
    <h1 class="text-lg font-semibold mb-4">Edit Profile</h1>
    <AsWfForm
      path="/api/wf"
      name="api/profile/edit"
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
          {{ loading ? "Saving…" : (text ?? "Save") }}
        </button>
      </template>
    </AsWfForm>
    <p class="mt-4 text-sm">
      <RouterLink to="/profile/change-password" class="text-blue-600 underline"
        >Change password</RouterLink
      >
    </p>
  </div>
</template>
