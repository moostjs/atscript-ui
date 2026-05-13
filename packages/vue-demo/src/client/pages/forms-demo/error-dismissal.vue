<script setup lang="ts">
import { ref } from "vue";
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import { ErrorDismissalForm } from "./schemas/error-dismissal.as";
import DarkToggle from "./_dark-toggle.vue";

const { def, formData } = createAsFormDef(ErrorDismissalForm);
const types = createDefaultTypes();

// External errors injected by the buttons below. We always replace the
// entire object reference so AsForm's `props.errors` identity-change
// watch fires (which re-arms the dismissable banner and the leaf
// auto-dismiss state).
const errors = ref<Record<string, string | undefined> | undefined>(undefined);
const loading = ref(false);

function triggerFormError() {
  errors.value = { __form: "Server-side rejection: that email is already taken" };
}

function triggerLeafError() {
  errors.value = { email: "Already used" };
}

function clearErrors() {
  errors.value = undefined;
}

function toggleLoading() {
  loading.value = !loading.value;
}

function onSubmit(data: unknown) {
  console.log("ErrorDismissalForm submitted:", data);
}

const btnClass = "c8-flat h-fingertip-s px-$m rounded-base font-600 text-callout";
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
        <h1 class="text-h3 m-0">Error dismissal & loading</h1>
        <p class="text-callout text-current-muted m-0 mt-$xxs">
          Manual harness for the three AsForm error-handling behaviours: external leaf auto-dismiss
          on edit, the loading overlay, and the dismissable
          <code>__form</code> banner. Each button replaces the entire <code>errors</code> object
          reference so the form's identity watch fires.
        </p>
        <RouterLink
          to="/forms-demo"
          class="text-callout text-current/60 underline mt-$xs self-start"
        >
          ← back to forms hub
        </RouterLink>
      </header>

      <div class="flex flex-wrap gap-$s">
        <button
          type="button"
          data-testid="trigger-form-error"
          :class="btnClass"
          @click="triggerFormError"
        >
          Trigger __form error
        </button>
        <button
          type="button"
          data-testid="trigger-leaf-error"
          :class="btnClass"
          @click="triggerLeafError"
        >
          Trigger leaf error
        </button>
        <button type="button" data-testid="clear-errors" :class="btnClass" @click="clearErrors">
          Clear errors
        </button>
        <button type="button" data-testid="toggle-loading" :class="btnClass" @click="toggleLoading">
          {{ loading ? "Stop loading" : "Toggle loading" }}
        </button>
      </div>

      <AsForm
        :def="def"
        :form-data="formData"
        :types="types"
        :errors="errors"
        :loading="loading"
        hide-root-title
        first-validation="on-submit"
        @submit="onSubmit"
      >
      </AsForm>

      <details class="mt-$l layer-0 border-1 rounded-r2 p-$m text-callout">
        <summary class="cursor-pointer font-600 text-current-muted">Form data preview</summary>
        <pre class="mt-$s overflow-auto text-callout">{{ JSON.stringify(formData, null, 2) }}</pre>
      </details>
    </div>
  </div>
</template>
