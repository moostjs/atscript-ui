<script setup lang="ts">
// Demonstrates overriding `#wf.finish.primary` so the consumer's design system
// can swap the default button without losing the trigger contract.
import { useRouter } from "vue-router";
import { AsWfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../../types/demo-types";
import { sharedFetch } from "../../api/fetch";

const router = useRouter();
const types = createDemoTypes();

function navigate(url: string) {
  void router.push(url);
}

function onDismiss() {
  // No-op for the demo — the dismiss action just leaves the user on the page.
}
</script>

<template>
  <div class="min-h-screen p-$l">
    <div class="max-w-[520px] mx-auto flex flex-col gap-$m">
      <h1 class="text-lg font-700 m-0">Finish · trigger: manual</h1>
      <p class="text-callout text-current/70 m-0">
        Submitting finishes with
        <code
          >finishWf(&#123; next: &#123; trigger: 'manual', primary, options &#125; &#125;)</code
        >. The primary button is the Enter-key target; this page overrides
        <code>#wf.finish.primary</code> with a custom-styled button.
      </p>
      <AsWfForm
        path="/api/wf"
        name="api/wf-demo/finish-manual"
        :types="types"
        :fetch="sharedFetch"
        first-validation="on-submit"
        :navigate="navigate"
        @dismiss="onDismiss"
      >
        <template #wf.finish.primary="{ button, trigger }">
          <button
            type="button"
            class="c8-filled scope-primary h-fingertip-m px-$m rounded-base font-600 shadow-popup"
            @click="trigger"
          >
            ★ {{ button.label }}
          </button>
        </template>
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
