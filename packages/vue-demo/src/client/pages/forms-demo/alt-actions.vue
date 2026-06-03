<script setup lang="ts">
import { ref } from "vue";
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import { AltActionsForm } from "./schemas/alt-actions.as";
import DarkToggle from "./_dark-toggle.vue";

const { def, formData } = createAsFormDef(AltActionsForm);
const types = createDefaultTypes();

const lastAction = ref<string | null>(null);
const lastSubmit = ref<string | null>(null);

function onAction(name: string) {
  lastAction.value = name;
  lastSubmit.value = null;
  console.log("AltActionsForm action:", name);
}

function onSubmit(data: unknown) {
  lastSubmit.value = JSON.stringify(data);
  lastAction.value = null;
  console.log("AltActionsForm submitted:", data);
}
</script>

<template>
  <div class="min-h-screen layer-1">
    <div class="max-w-xl mx-auto p-$l flex flex-col gap-$l">
      <header class="flex flex-col gap-$xs">
        <div class="flex items-center justify-between gap-$s">
          <p
            class="font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0"
          >
            atscript-ui · forms demo
          </p>
          <DarkToggle />
        </div>
        <h1 class="text-h3 m-0">Alt actions · text, push-down & align</h1>
        <p class="text-callout text-current-muted m-0 mt-$xxs">
          One <code>@ui.form.action</code> sits inline in the password field's footer. Three more
          carry <code>@ui.form.pushDown</code> so they render in their own grid <em>below</em> the
          submit button — each with a <code>text</code> prefix and/or <code>align</code> set via
          <code>@ui.form.attr</code>. Click any action: the banner shows which id fired (none of
          them submit the form).
        </p>
        <RouterLink
          to="/forms-demo"
          class="text-callout text-current/60 underline mt-$xs self-start"
        >
          ← back to forms hub
        </RouterLink>
      </header>

      <AsForm
        data-testid="alt-actions-form"
        :def="def"
        :form-data="formData"
        :types="types"
        hide-root-title
        first-validation="on-submit"
        @submit="onSubmit"
        @action="onAction"
      >
      </AsForm>

      <div
        v-if="lastAction"
        data-testid="alt-actions-last"
        class="scope-primary layer-0 border-1 rounded-r2 p-$m text-callout"
      >
        Action fired: <span class="font-700 text-current-hl">{{ lastAction }}</span>
      </div>
      <div
        v-else-if="lastSubmit"
        data-testid="alt-actions-submit"
        class="scope-good layer-0 border-1 rounded-r2 p-$m text-callout"
      >
        Submitted: <span class="font-mono text-current-hl">{{ lastSubmit }}</span>
      </div>

      <details class="layer-0 border-1 rounded-r2 p-$m text-callout">
        <summary class="cursor-pointer font-600 text-current-muted">Schema (.as)</summary>
        <pre class="mt-$s overflow-auto text-callout leading-[1.5]">
@ui.form.pushDown
@ui.form.attr 'text', 'Already have an account?'
@ui.form.attr 'align', 'center'
@ui.form.action 'sign-in', 'Sign in'
signinAction: ui.action</pre
        >
      </details>
    </div>
  </div>
</template>
