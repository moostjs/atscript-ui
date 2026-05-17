<script setup lang="ts">
// Three sequential input rounds — the form schema swaps automatically as the
// workflow advances. A small step indicator above the form reads `step`
// from the passed-through context.
import { ref } from "vue";
import { AsWfForm } from "@atscript/vue-wf";
import type { FormDef } from "@atscript/ui";
import { createDemoTypes } from "../../types/demo-types";
import { sharedFetch } from "../../api/fetch";

const types = createDemoTypes();
const step = ref<number>(0);

function onForm(_def: FormDef, ctx?: Record<string, unknown>) {
  const n = ctx?.step;
  if (typeof n === "number") step.value = n;
}
</script>

<template>
  <div class="min-h-screen p-$l">
    <div class="max-w-[520px] mx-auto flex flex-col gap-$m">
      <h1 class="text-lg font-700 m-0">Multi-step · 3 rounds</h1>
      <p class="text-callout text-current/70 m-0">
        Three sequential input rounds, each with its own form. The form schema swaps automatically
        on each <code>inputRequired</code> response.
      </p>
      <div v-if="step > 0" class="text-caption text-current/60" data-testid="multi-step-indicator">
        Step {{ step }} of 3
      </div>
      <AsWfForm
        path="/api/wf"
        name="api/wf-demo/multi-step"
        :types="types"
        :fetch="sharedFetch"
        first-validation="on-submit"
        @form="onForm"
      >
        <template #form.submit="{ disabled, loading, text }">
          <button
            type="submit"
            :disabled="disabled || loading"
            class="c8-filled scope-primary h-fingertip-m px-$m rounded-base font-600 disabled:opacity-50"
          >
            {{ loading ? "Running…" : (text ?? "Continue") }}
          </button>
        </template>
      </AsWfForm>
    </div>
  </div>
</template>
