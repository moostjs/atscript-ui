<script setup lang="ts">
// Default AsWfFinish renders just the banner when the envelope has neither
// `data` nor `end`. This page exists to verify that visual contract.
import { AsWfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../../types/demo-types";
import { sharedFetch } from "../../api/fetch";

const types = createDemoTypes();
</script>

<template>
  <div class="min-h-screen p-$l">
    <div class="max-w-[520px] mx-auto flex flex-col gap-$m">
      <h1 class="text-lg font-700 m-0">Finish · message only</h1>
      <p class="text-callout text-current/70 m-0">
        Submitting finishes with
        <code>finishWfWithMessage('info', '…')</code>. The default <code>AsWfFinish</code> renders
        just the banner — no countdown, no buttons.
      </p>
      <AsWfForm
        path="/api/wf"
        name="api/wf-demo/finish-message"
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
            {{ loading ? "Running…" : (text ?? "Run") }}
          </button>
        </template>
      </AsWfForm>
    </div>
  </div>
</template>
