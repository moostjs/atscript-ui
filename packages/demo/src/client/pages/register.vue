<script setup lang="ts">
import { useRouter } from "vue-router";
import { WfForm } from "@atscript/vue-wf";
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
  <div class="min-h-screen grid place-items-center">
    <div class="flex flex-col gap-3 min-w-[360px] p-6 border-1 rounded">
      <h1 class="text-lg font-semibold">AtShop — Register</h1>
      <WfForm
        path="/api/wf"
        name="api/auth/register"
        :types="types"
        first-validation="on-submit"
        @finished="onFinished"
      >
        <template #wf.loading>
          <div class="p-4 text-sm text-gray-500">Loading…</div>
        </template>
        <template #wf.error="{ error, retry }">
          <div class="p-4 text-red-600 text-sm">
            <p>{{ (error as any)?.message ?? "Error" }}</p>
            <button class="mt-2 text-blue-600 underline" @click="retry">Retry</button>
          </div>
        </template>
      </WfForm>
      <p class="text-sm text-gray-500">
        Already have an account? <RouterLink to="/login" class="text-blue-600 underline">Sign in</RouterLink>
      </p>
    </div>
  </div>
</template>
