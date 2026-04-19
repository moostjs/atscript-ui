<script setup lang="ts">
import { inject, ref } from "vue";
import { WfForm } from "@atscript/vue-wf";
import { createDefaultTypes } from "@atscript/vue-form";

const showToast = inject<(msg: string) => void>("showToast")!;
const types = createDefaultTypes();
const finishedData = ref<Record<string, unknown> | null>(null);
const formContext = ref<Record<string, unknown>>({});

function onFinished(response: unknown) {
  finishedData.value = response as Record<string, unknown>;
  showToast("Profile saved!");
}

function onError(err: { message: string }) {
  showToast(`Error: ${err.message}`);
}

function onForm(_def: unknown, context?: Record<string, unknown>) {
  formContext.value = context ?? {};
  if (context?.draftSaved) {
    showToast("Draft saved!");
  }
}
</script>

<template>
  <div class="view-layout">
    <div class="view-form">
      <div class="view-form-inner">
        <div class="view-eyebrow">atscript-ui · Workflows</div>
        <h2>Profile Draft (Workflow)</h2>
        <p class="view-intro">
          Edit profile with save-draft support. Click "Save Draft" to send partial data with
          deep-partial validation (tests <code>@wf.action.withData</code>). Click "Save Profile" for
          full validation and submit.
        </p>
        <WfForm
          path="/wf/trigger"
          name="profile/edit"
          :types="types"
          first-validation="on-submit"
          @finished="onFinished"
          @error="onError"
          @form="onForm"
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
              <h3>Profile Saved!</h3>
              <pre>{{ JSON.stringify(response, null, 2) }}</pre>
            </div>
          </template>
        </WfForm>
      </div>
    </div>
    <div class="form-debug">
      <div class="form-debug-card rounded-base">
        <div class="form-debug-label">Workflow State</div>
        <template v-if="finishedData">
          Finished: {{ JSON.stringify(finishedData, null, 2) }}
        </template>
        <template v-else-if="formContext.draftSaved">
          <div style="color: #4ade80; margin-bottom: 8px">Draft saved on server</div>
          <pre
            style="
              font-size: 12px;
              background: rgba(255, 255, 255, 0.08);
              padding: 8px;
              border-radius: 4px;
              overflow: auto;
              color: #e2e8f0;
            "
            >{{ JSON.stringify(formContext, null, 2) }}</pre
          >
        </template>
        <template v-else>Waiting for workflow to complete...</template>
      </div>
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
.view-hint code {
  background: #f3f4f6;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
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
