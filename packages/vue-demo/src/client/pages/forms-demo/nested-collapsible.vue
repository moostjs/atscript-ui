<script setup lang="ts">
import { computed } from "vue";
import {
  AsForm,
  createDefaultTypes,
  provideAsNestedSectionsStore,
  createAsFormDef,
} from "@atscript/vue-form";
import { CompanySettings } from "./schemas/company-settings.as";
import DarkToggle from "./_dark-toggle.vue";

const { def, formData } = createAsFormDef(CompanySettings);
const types = createDefaultTypes();

// Provide the store at page level so AsForm picks it up (instead of creating
// its own). That gives the page-level Expand all / Collapse all buttons a
// shared handle on the same store the form sections register with.
const sections = provideAsNestedSectionsStore();
const allOpen = computed(() => sections.allOpen());

function onSubmit(data: unknown) {
  console.log("CompanySettings submitted:", data);
}
</script>

<template>
  <div class="min-h-screen layer-1">
    <div class="max-w-2xl mx-auto p-$l flex flex-col gap-$l">
      <header class="flex flex-col gap-$xs">
        <div class="flex items-center justify-between gap-$s">
          <p class="font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0">
            atscript-ui · forms demo
          </p>
          <DarkToggle />
        </div>
        <div class="flex items-start gap-$m">
          <div class="flex-1">
            <h1 class="text-h3 m-0">Company Settings</h1>
            <p class="text-callout text-current-muted m-0 mt-$xxs">
              Each nested struct is a collapsible section. Click a header to fold it.
            </p>
          </div>
          <div class="flex gap-$xs shrink-0 mt-$xxs">
            <button
              type="button"
              class="c8-flat h-fingertip-s px-$m rounded-base font-600 text-callout"
              :disabled="allOpen"
              @click="sections.expandAll()"
            >
              Expand all
            </button>
            <button
              type="button"
              class="c8-flat h-fingertip-s px-$m rounded-base font-600 text-callout"
              @click="sections.collapseAll()"
            >
              Collapse all
            </button>
          </div>
        </div>
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
        hide-root-title
        first-validation="on-submit"
        @submit="onSubmit"
      >
      </AsForm>
    </div>
  </div>
</template>
