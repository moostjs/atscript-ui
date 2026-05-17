<script setup lang="ts">
// Server-side validation: an email ending in `@example.com` or `@test.com`
// triggers an inline error via `inputRequired.context.errors`. The form
// preserves user-entered values across re-validation (same schema, new errors).
import { AsWfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../../types/demo-types";
import { sharedFetch } from "../../api/fetch";

const types = createDemoTypes();
</script>

<template>
  <div class="min-h-screen p-$l">
    <div class="max-w-[520px] mx-auto flex flex-col gap-$m">
      <h1 class="text-lg font-700 m-0">Server-side validation errors</h1>
      <p class="text-callout text-current/70 m-0">
        Submitting an <code>@example.com</code> or <code>@test.com</code> address re-issues the form
        with an inline error. User-entered values are preserved across the re-validation round-trip.
      </p>
      <AsWfForm
        path="/api/wf"
        name="api/wf-demo/validation-errors"
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
            {{ loading ? "Running…" : (text ?? "Submit") }}
          </button>
        </template>
      </AsWfForm>
    </div>
  </div>
</template>
