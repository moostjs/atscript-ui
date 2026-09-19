<!--
  Custom control from the canonical form example (docs/forms/canonical-example.md).

  Registered under the `priority` key in the form's `types` map and selected by
  `@ui.type 'priority'` on the field. It renders the literal-union options that
  `@atscript/ui` already resolved into `props.options`, so the control owns the
  look only — never the option list.
-->
<script setup lang="ts">
import { optKey, optLabel } from "@atscript/ui";
import type { TAsComponentProps } from "../../components/types";
import AsFieldShell from "../../components/defaults/as-field-shell.vue";

const props = defineProps<TAsComponentProps<string>>();

function pick(next: string): void {
  props.model.value = next;
  props.onBlur();
}
</script>

<template>
  <AsFieldShell v-bind="$props" field-class="ticket-priority">
    <template #default="{ inputId }">
      <div
        :id="inputId"
        class="ticket-priority-group"
        role="group"
        :aria-describedby="ariaDescribedBy"
      >
        <button
          v-for="opt in options"
          :key="optKey(opt)"
          type="button"
          class="ticket-priority-option"
          :name="name"
          :value="optKey(opt)"
          :disabled="disabled"
          :aria-pressed="model.value === optKey(opt)"
          @click="pick(optKey(opt))"
        >
          {{ optLabel(opt) }}
        </button>
      </div>
    </template>
  </AsFieldShell>
</template>
