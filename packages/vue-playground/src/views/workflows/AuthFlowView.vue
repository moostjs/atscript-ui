<script setup lang="ts">
import { inject, ref } from "vue";
import { WfForm } from "@atscript/vue-wf";
import { createDefaultTypes } from "@atscript/vue-form";

const showToast = inject<(msg: string) => void>("showToast")!;
const types = createDefaultTypes();
const finishedData = ref<Record<string, unknown> | null>(null);

function onFinished(response: unknown) {
  finishedData.value = response as Record<string, unknown>;
  showToast("Auth flow completed!");
}

function onError(err: { message: string }) {
  showToast(`Error: ${err.message}`);
}
</script>

<template>
  <h2>Auth Flow (Workflow)</h2>
  <p class="view-hint">
    Multi-step login flow: Login (admin/password) &rarr; MFA (123456) &rarr; Done.
    <br />Try wrong credentials, alt actions (forgot password, resend, switch method).
  </p>
  <div class="view-layout">
    <div class="view-form">
      <WfForm
        path="/wf/trigger"
        name="auth/login"
        :types="types"
        first-validation="on-submit"
        @finished="onFinished"
        @error="onError"
      >
        <template #wf.loading>
          <div class="wf-loading">Loading form...</div>
        </template>
        <template #wf.error="{ error, retry }">
          <div class="wf-error">
            <p>{{ (error as any)?.message || error }}</p>
            <button @click="retry">Retry</button>
          </div>
        </template>
        <template #wf.finished="{ response }">
          <div class="wf-finished">
            <h3>Authenticated!</h3>
            <pre>{{ JSON.stringify(response, null, 2) }}</pre>
          </div>
        </template>
      </WfForm>
    </div>
    <div class="form-debug">
      <div class="form-debug-label">Workflow State</div>
      <template v-if="finishedData">
        Finished: {{ JSON.stringify(finishedData, null, 2) }}
      </template>
      <template v-else>Waiting for workflow to complete...</template>
    </div>
  </div>
</template>

<style scoped>
.view-hint {
  color: #6b7280;
  font-size: 13px;
  margin-bottom: 16px;
  line-height: 1.5;
}
.wf-loading {
  padding: 24px;
  color: #6b7280;
  text-align: center;
}
.wf-error {
  padding: 24px;
  color: #dc2626;
  text-align: center;
}
.wf-error button {
  margin-top: 12px;
}
.wf-finished {
  padding: 24px;
  color: #065f46;
}
.wf-finished pre {
  font-size: 12px;
  background: #f0fdf4;
  padding: 12px;
  border-radius: 6px;
  overflow: auto;
}
</style>
