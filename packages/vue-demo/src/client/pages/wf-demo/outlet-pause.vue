<script setup lang="ts">
// Demonstrates the outlet-pause UX. After submit the server emits
// `outletEmail(...)` and the response is `{ sent: true }` — `useWfForm` treats
// this as "finished from this session's POV" so the `@finished` event fires
// and `wf.finishedPayload` stays `null`. The default `wf.finished` slot is
// empty in that case, so we render a custom "check your email" screen.
import { ref } from "vue";
import { AsWfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../../types/demo-types";
import { sharedFetch } from "../../api/fetch";

const types = createDemoTypes();
const sent = ref(false);

function onFinished(_response: unknown) {
  sent.value = true;
}
</script>

<template>
  <div class="min-h-screen p-$l">
    <div class="max-w-[520px] mx-auto flex flex-col gap-$m">
      <h1 class="text-lg font-700 m-0">Outlet pause · check your email</h1>
      <p class="text-callout text-current/70 m-0">
        Submitting emits <code>outletEmail(...)</code>; the workflow pauses waiting for out-of-band
        resumption (a magic link). The client sees <code>&#123; sent: true &#125;</code> and treats
        the session as finished. Resumption happens when the recipient clicks the link (logged to
        server console here).
      </p>
      <AsWfForm
        path="/api/wf"
        name="api/wf-demo/outlet-pause"
        :types="types"
        :fetch="sharedFetch"
        first-validation="on-submit"
        @finished="onFinished"
      >
        <template #wf.finished>
          <div
            class="p-$m layer-0 border-1 rounded-r2"
            data-testid="outlet-pause-sent"
            :data-sent="sent ? 'true' : 'false'"
          >
            <h2 class="text-body-l font-700 m-0 mb-$xs">Check your email</h2>
            <p class="text-body text-current/70 m-0">
              We sent a magic link to <code>demo@example.com</code>. Click it to continue.
            </p>
          </div>
        </template>
        <template #form.submit="{ disabled, loading }">
          <button
            type="submit"
            :disabled="disabled || loading"
            class="c8-filled scope-primary h-fingertip-m px-$m rounded-base font-600 disabled:opacity-50"
          >
            {{ loading ? "Sending…" : "Send link" }}
          </button>
        </template>
      </AsWfForm>
    </div>
  </div>
</template>
