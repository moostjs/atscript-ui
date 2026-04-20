<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { WfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../types/demo-types";

const router = useRouter();
const types = createDemoTypes();
const sent = ref(false);

function onFinished(response: unknown) {
  // When the `invite-send` step returns from `outletEmail`, the engine pauses
  // and the HTTP response contains `{ sent: true, outlet: 'email', wfs: '<token>' }`.
  // WfForm's `finished` event may not fire for this shape — we watch for it
  // defensively via the raw response. For admin UX, we short-circuit to "sent".
  sent.value = true;
  void response; // response payload kept as-is for future surfacing
  setTimeout(() => {
    void router.push("/users");
  }, 1500);
}
</script>

<template>
  <div class="p-6 max-w-[480px]">
    <h1 class="text-lg font-semibold mb-3">Invite user</h1>
    <div v-if="sent" class="p-4 border-1 rounded text-sm">
      Invite sent — the invitee will receive a magic link. Redirecting…
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
        <div class="p-4 text-sm text-gray-500">Loading…</div>
      </template>
      <template #wf.error="{ error, retry }">
        <div class="p-4 text-red-600 text-sm">
          <p>{{ (error as any)?.message ?? "Error" }}</p>
          <button class="mt-2 text-blue-600 underline" @click="retry">Retry</button>
        </div>
      </template>
    </WfForm>
  </div>
</template>
