<script setup lang="ts">
// The form exposes two actions — primary submit + `@ui.form.action 'cancel'`.
// On cancel the server emits `abortWf` with a `warn` banner; on submit it
// finishes with success data.
import { AsWfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../../types/demo-types";
import { sharedFetch } from "../../api/fetch";

const types = createDemoTypes();
</script>

<template>
  <div class="min-h-screen p-$l">
    <div class="max-w-[520px] mx-auto flex flex-col gap-$m">
      <h1 class="text-lg font-700 m-0">Finish · aborted</h1>
      <p class="text-callout text-current/70 m-0">
        Two finish paths: submit calls
        <code>finishWf(&#123; data: &#123;ok:true&#125;, message &#125;)</code>; clicking "Cancel"
        calls <code>abortWf('user-cancel', &#123; message &#125;)</code>. Both terminate the
        workflow.
      </p>
      <AsWfForm
        path="/api/wf"
        name="api/wf-demo/finish-aborted"
        :types="types"
        :fetch="sharedFetch"
        first-validation="on-submit"
      >
        <template #form.submit="{ disabled, loading, text }">
          <button
            type="submit"
            :disabled="disabled || loading"
            class="c8-filled scope-primary h-fingertip-m px-$m rounded-base font-600 disabled:opacity-50"
          >
            {{ loading ? "Running…" : (text ?? "Submit") }}
          </button>
        </template>
      </AsWfForm>
    </div>
  </div>
</template>
