<script setup lang="ts">
// Wires `@navigate` to the router so the soft redirect routes inside the SPA
// instead of falling back to window.location.href.
import { useRouter } from "vue-router";
import { AsWfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../../types/demo-types";
import { sharedFetch } from "../../api/fetch";

const router = useRouter();
const types = createDemoTypes();

function onNavigate(payload: { target: string; mode: "soft" | "hard"; reason?: string }) {
  void router.push(payload.target);
}
</script>

<template>
  <div class="min-h-screen p-$l">
    <div class="max-w-[520px] mx-auto flex flex-col gap-$m">
      <h1 class="text-lg font-700 m-0">Finish · mode: immediate</h1>
      <p class="text-callout text-current/70 m-0">
        Submitting the form finishes the workflow with
        <code>finishWfWithRedirect('/wf-demo', &#123; mode: 'soft' &#125;)</code>. The default
        <code>AsWfFinish</code> fires the action on mount.
      </p>
      <AsWfForm
        path="/api/wf"
        name="api/wf-demo/finish-immediate"
        :types="types"
        :fetch="sharedFetch"
        first-validation="on-submit"
        @navigate="onNavigate"
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
