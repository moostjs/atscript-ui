<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { WfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../types/demo-types";

const router = useRouter();
const types = createDemoTypes();
const sent = ref(false);

function onFinished() {
  sent.value = true;
  setTimeout(() => {
    void router.push("/users");
  }, 1500);
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="as-page-narrow">
      <div class="as-page-eyebrow">atscript-ui demo · Users</div>
      <h1 class="as-page-title">Invite user</h1>
      <div
        v-if="sent"
        class="flex items-center gap-$s p-$m border-1 rounded-base scope-good layer-0 text-callout"
      >
        <span class="i-ph:check-circle text-[1.25em]" aria-hidden="true" />
        <span>Invite sent — the invitee will receive a magic link. Redirecting…</span>
      </div>
      <WfForm
        v-else
        path="/api/wf"
        name="api/users/invite"
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
          {{ loading ? "Sending…" : (text ?? "Send invite") }}
        </button>
      </template>
      </WfForm>
    </div>
  </div>
</template>
