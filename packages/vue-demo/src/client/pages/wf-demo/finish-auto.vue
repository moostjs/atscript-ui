<script setup lang="ts">
// Demonstrates a custom countdown slot — the consumer overrides
// `#wf.finish.countdown` to render a progress bar in addition to the seconds.
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { AsWfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../../types/demo-types";
import { sharedFetch } from "../../api/fetch";

const router = useRouter();
const types = createDemoTypes();

const totalSecondsRef = ref(0);

function onNavigate(payload: { target: string; mode: "soft" | "hard"; reason?: string }) {
  void router.push(payload.target);
}

function progressPct(remaining: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
}
</script>

<template>
  <div class="min-h-screen p-$l">
    <div class="max-w-[520px] mx-auto flex flex-col gap-$m">
      <h1 class="text-lg font-700 m-0">Finish · mode: auto</h1>
      <p class="text-callout text-current/70 m-0">
        Submitting finishes with
        <code>finishWfWithRedirect('/wf-demo', &#123; autoMs: 4000, skipLabel: 'Go now' &#125;)</code
        >. The default <code>AsWfFinish</code> renders the countdown text + skip button. Below the
        demo overrides <code>#wf.finish.countdown</code> with a progress bar.
      </p>
      <AsWfForm
        path="/api/wf"
        name="api/wf-demo/finish-auto"
        :types="types"
        :fetch="sharedFetch"
        first-validation="on-submit"
        @navigate="onNavigate"
      >
        <template #wf.finish.countdown="{ secondsRemaining, totalSeconds }">
          <div class="flex flex-col gap-$xs">
            <div class="flex items-baseline justify-between">
              <span class="text-callout">Continuing in {{ secondsRemaining }}s…</span>
              <span class="text-caption text-current/60 font-mono"
                >{{ totalSeconds - secondsRemaining }}/{{ totalSeconds }}</span
              >
            </div>
            <div class="h-1 layer-1 rounded-r1 overflow-hidden">
              <div
                class="h-full c8-filled scope-primary transition-all"
                :style="{ width: `${progressPct(secondsRemaining, totalSeconds)}%` }"
              />
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
