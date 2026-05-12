<script setup lang="ts">
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import { EventRegistration } from "./schemas/dynamic-form.as";
import DarkToggle from "./_dark-toggle.vue";

// Single `<AsForm>` showcasing every `@ui.form.fn.*` annotation. The
// `@atscript/ui-fns` dynamic resolver is wired globally in
// `src/entry-client.ts` + `src/entry-server.ts`, so the form-level title
// + submit text/disabled and per-field label/description/hint/placeholder/
// hidden/disabled/readonly/options/value/classes/styles all re-evaluate
// reactively as `formData` mutates. A custom `@ui.form.validate` string
// caps `notes` at 500 chars and triggers the same submit-time error
// pipeline as built-in `@expect.*` rules.
const { def, formData } = createAsFormDef(EventRegistration);
const types = createDefaultTypes();

function onSubmit(data: unknown) {
  console.log("EventRegistration submitted:", data);
}
</script>

<template>
  <div class="min-h-screen layer-1">
    <div class="max-w-2xl mx-auto p-$l flex flex-col gap-$l">
      <header class="flex flex-col gap-$xs">
        <div class="flex items-center justify-between gap-$s">
          <p
            class="font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0"
          >
            atscript-ui · forms demo
          </p>
          <DarkToggle />
        </div>
        <h1 class="text-h3 m-0">Dynamic fn-driven props</h1>
        <p class="text-callout text-current-muted m-0 mt-$xxs">
          Every prop on this form is driven by a different
          <code>@ui.form.fn.*</code> annotation — type into a field and watch dependent fields,
          their labels, hints, options, visibility, and chrome (form title + submit button
          text/disabled) react in real time. The <code>notes</code> field exercises
          <code>@ui.form.validate</code>
          for a custom 500-char ceiling.
        </p>
        <RouterLink
          to="/forms-demo"
          class="text-callout text-current/60 underline mt-$xs self-start"
        >
          ← back to forms hub
        </RouterLink>
      </header>

      <AsForm
        :def="def"
        :form-data="formData"
        :types="types"
        first-validation="on-submit"
        data-testid="dynamic-form"
        @submit="onSubmit"
      />

      <details class="mt-$l layer-0 border-1 rounded-r2 p-$m text-callout">
        <summary class="cursor-pointer font-600 text-current-muted">Form data preview</summary>
        <pre class="mt-$s overflow-auto text-callout" data-testid="dynamic-form-preview">{{
          JSON.stringify(formData, null, 2)
        }}</pre>
      </details>
    </div>
  </div>
</template>
