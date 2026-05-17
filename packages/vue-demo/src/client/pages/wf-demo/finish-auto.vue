<script setup lang="ts">
// Default `AsWfFinish` rendering: the countdown text now sits above a
// CSS-animated progress bar and the skip button fills L→R at the same
// rate. Both run on the new `c8-progress` primitive — see
// `ui-styles/src/shortcuts/common/c8-progress.ts`. No countdown override
// needed; this page exists to showcase the polished default.
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
        >. The default <code>AsWfFinish</code> renders the countdown text with a smooth progress
        bar below it and a progress-fill skip button — both run on CSS animations timed by the
        auto-fire duration.
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
