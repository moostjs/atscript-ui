<script setup lang="ts">
import { computed } from "vue";
import { AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";

/**
 * Number stepper — `[ - ][ input ][ + ]` — registered via the
 * `components` map under the name `'stepper'` and opted-in per field
 * with `@ui.form.component 'stepper'`. Used by Section B's
 * `quantity: number`.
 *
 * Clamped to `>= 0` (the schema isn't currently marked `@meta.min 0`;
 * Step 2 clamps unconditionally for simplicity).
 *
 * Wrapped in the library's `<AsFieldShell>` so label, description, and
 * error chrome stay consistent with built-in fields.
 *
 * Skipped `useAsNumber` here — the composable's value pipeline assumes
 * a single text input with locale-aware decimal parsing; the stepper
 * uses an HTML number input plus +/- buttons committing integers, so
 * direct prop binding stays cleaner.
 *
 * Styling: the wrapper paints the merged-chrome border + focus ring
 * (mirrors `as-decimal`/`as-number`). The inner `<input>` is escaped
 * from the ambient `as-default-field` descendant chrome (which paints
 * its own border/height/bg on every `<input>`) via `!`-qualified
 * resets — same canonical pattern as `innerInputReset` in
 * `packages/ui-styles/src/shortcuts/form/as-decimal-number.ts`.
 * +/- buttons use `c8-flat` for proper hover/active feedback in any
 * scope.
 */
const props = defineProps<TAsComponentProps<number | null | undefined>>();

const current = computed(() => props.model.value ?? 0);

function commit(n: number): void {
  const clamped = Math.max(0, n);
  props.model.value = clamped;
}

function dec(): void {
  commit(current.value - 1);
}

function inc(): void {
  commit(current.value + 1);
}

function onInput(e: Event): void {
  const el = e.target as HTMLInputElement;
  if (el.value === "") {
    props.model.value = null;
    return;
  }
  const n = Number(el.value);
  if (Number.isFinite(n)) commit(n);
}

function onGroupBlur(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null;
  const group = e.currentTarget as HTMLElement;
  if (group && next && group.contains(next)) return;
  props.onBlur();
}
</script>

<template>
  <AsFieldShell v-bind="$props" data-testid="demo-number-stepper">
    <template #default="{ inputId }">
      <div
        class="inline-flex items-stretch w-fit layer-0 border-1 rounded-base overflow-hidden h-fingertip-m focus-within:current-border-hl focus-within:outline focus-within:i8-apply-outline"
        :class="{ 'scope-error current-border-hl border-current': !!error }"
        @focusout="onGroupBlur"
      >
        <button
          type="button"
          class="c8-flat appearance-none border-0 px-$m h-full cursor-pointer text-body-l leading-none rounded-none disabled-soft"
          aria-label="Decrement"
          :disabled="disabled || readonly || current <= 0"
          @click="dec"
        >
          −
        </button>
        <input
          :id="inputId"
          type="number"
          class="demo-stepper-input !w-[4em] !h-full !bg-transparent !border-0 !rounded-none !outline-none !ring-0 !shadow-none !px-$xs !layer-0 text-center !text-scope-dark-0 dark:!text-scope-light-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0 disabled:!text-current/40 disabled:!cursor-not-allowed border-l-1 border-r-1 border-current/20"
          :value="model.value ?? ''"
          :placeholder="placeholder"
          :name="name"
          :disabled="disabled"
          :readonly="readonly"
          :aria-required="required || undefined"
          :aria-invalid="!!error || undefined"
          :aria-describedby="ariaDescribedBy"
          :aria-label="!label ? name : undefined"
          min="0"
          @input="onInput"
        />
        <button
          type="button"
          class="c8-flat appearance-none border-0 px-$m h-full cursor-pointer text-body-l leading-none rounded-none disabled-soft"
          aria-label="Increment"
          :disabled="disabled || readonly"
          @click="inc"
        >
          +
        </button>
      </div>
    </template>
  </AsFieldShell>
</template>
