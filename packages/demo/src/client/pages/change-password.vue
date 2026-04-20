<script setup lang="ts">
import { useRouter } from "vue-router";
import { WfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../types/demo-types";

const router = useRouter();
const types = createDemoTypes();

function onFinished() {
  void router.push("/profile");
}
</script>

<template>
  <div class="p-6 max-w-[520px]">
    <h1 class="text-lg font-semibold mb-4">Change Password</h1>
    <WfForm
      path="/api/wf"
      name="api/security/change-password"
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
          {{ loading ? "Updating…" : (text ?? "Update password") }}
        </button>
      </template>
    </WfForm>
  </div>
</template>
