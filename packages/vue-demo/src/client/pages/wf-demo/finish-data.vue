<script setup lang="ts">
// Demonstrates overriding `#wf.finished` so the consumer renders typed
// `payload.data` alongside the default banner.
import { AsWfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../../types/demo-types";
import { sharedFetch } from "../../api/fetch";

const types = createDemoTypes();
</script>

<template>
  <div class="min-h-screen p-$l">
    <div class="max-w-[520px] mx-auto flex flex-col gap-$m">
      <h1 class="text-lg font-700 m-0">Finish · data payload</h1>
      <p class="text-callout text-current/70 m-0">
        Submitting finishes with
        <code>finishWfWithData(&#123; greeting, timestamp &#125;, &#123; level, text &#125;)</code>.
        No <code>end</code> action — the demo overrides <code>#wf.finished</code> to render the
        typed <code>payload.data</code> below the default banner.
      </p>
      <AsWfForm
        path="/api/wf"
        name="api/wf-demo/finish-data"
        :types="types"
        :fetch="sharedFetch"
        first-validation="on-submit"
      >
        <template #wf.finished="{ payload }">
          <div class="flex flex-col gap-$s">
            <div
              v-if="payload?.message"
              class="p-$m layer-0 border-1 rounded-r2"
              :data-level="payload.message.level"
            >
              {{ payload.message.text }}
            </div>
            <div
              v-if="payload?.data"
              class="p-$m layer-0 border-1 rounded-r2 flex flex-col gap-$xs"
              data-testid="finish-data-payload"
            >
              <div class="text-callout text-current/60">Greeting</div>
              <div class="text-body-l">{{ (payload.data as any).greeting }}</div>
              <div class="text-caption text-current/50 font-mono">
                ts: {{ (payload.data as any).timestamp }}
              </div>
            </div>
          </div>
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
