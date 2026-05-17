<script setup lang="ts">
// Default `AsWfFinish` rendering: the skip button fills L→R via the
// `c8-progress` primitive (see `ui-styles/src/shortcuts/common/c8-progress.ts`)
// with the countdown text below it. No countdown override needed; this page
// exercises the default.
import { useRouter } from "vue-router";
import { AsWfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../../types/demo-types";
import { sharedFetch } from "../../api/fetch";

const router = useRouter();
const types = createDemoTypes();

function navigate(url: string) {
  void router.push(url);
}
</script>

<template>
  <div class="min-h-screen p-$l">
    <div class="max-w-[520px] mx-auto flex flex-col gap-$m">
      <h1 class="text-lg font-700 m-0">Finish · mode: auto</h1>
      <p class="text-callout text-current/70 m-0">
        Submitting finishes with
        <code
          >finishWfWithRedirect('/wf-demo', &#123; autoMs: 4000, skipLabel: 'Go now' &#125;)</code
        >. The default <code>AsWfFinish</code> renders a progress-fill skip button with the
        countdown text below it — the fill runs on a CSS animation timed by the auto-fire duration.
      </p>
      <AsWfForm
        path="/api/wf"
        name="api/wf-demo/finish-auto"
        :types="types"
        :fetch="sharedFetch"
        first-validation="on-submit"
        :navigate="navigate"
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
