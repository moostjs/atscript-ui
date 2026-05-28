<script setup lang="ts">
// Server seeds `ctx.totpUri` + `ctx.magicLink` and ships them to the client via
// `@wf.context.pass`. The schema declares each field as `ui.paragraph` (phantom)
// with `@ui.form.fn.value '(v, data, ctx) => ctx.<key>'` — AsField resolves the
// fn against `{ v, data, context, entry }` and hands the result to the component
// via `props.value` (phantom display value, no form-data roundtrip).
import { AsWfForm } from "@atscript/vue-wf";
import { AsCopy, AsQrCode } from "@atscript/vue-aooth";
import { createDemoTypes } from "../../types/demo-types";
import { sharedFetch } from "../../api/fetch";

const types = createDemoTypes();
const components = { "qr-code": AsQrCode, copy: AsCopy };
</script>

<template>
  <div class="min-h-screen p-$l">
    <div class="max-w-[520px] mx-auto flex flex-col gap-$m">
      <h1 class="text-lg font-700 m-0">QR code + copy field</h1>
      <p class="text-callout text-current/70 m-0">
        Server pre-fills a fake TOTP URI and a magic-link URL into a form whose fields are rendered
        by <code>AsQrCode</code> and <code>AsCopy</code> (from <code>@atscript/vue-aooth</code>).
        Scan with an authenticator (the secret is also shown as a text fallback), click Copy on the
        magic link to test clipboard, then Continue to finish.
      </p>
      <AsWfForm
        path="/api/wf"
        name="api/wf-demo/qr-and-copy"
        :types="types"
        :components="components"
        :fetch="sharedFetch"
        first-validation="on-submit"
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
