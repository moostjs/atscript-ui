<script setup lang="ts">
import { computed } from "vue";
import type { TAsComponentProps } from "../types";
import { committedText, committedValue } from "../../composables/_shape";

// `inputId` is supplied per-mount by AsFieldShell's slot so the chrome and
// the input share the same id. Other a11y wiring (`ariaDescribedBy`, etc.)
// flows through `v-bind="$props"` from AsField — single source of truth.
const props = defineProps<
  TAsComponentProps & {
    inputId: string;
  }
>();

/**
 * The model as the input edits it. Emptied, the input commits `undefined` on
 * an optional field; on a required one `""`, or `null` for the native number
 * input (AsNumber without adornments) — the rule of the other number inputs.
 */
const inputModel = computed({
  get: () => props.model.value,
  set: (v: unknown) => {
    props.model.value =
      v === "" && props.type === "number"
        ? committedValue(null, props.optional)
        : committedText(v, props.optional);
  },
});

/**
 * UX polish — numeric inputs select-all on focus so the next keystroke
 * replaces the existing value. Skipped for text/password/textarea where
 * the cursor-at-position behaviour is expected (clicking inside a long
 * email or sentence to fix one character shouldn't wipe it).
 */
function onFocus(e: FocusEvent): void {
  if (props.type !== "number") return;
  const el = e.target as HTMLInputElement | null;
  if (el && typeof el.select === "function") el.select();
}
</script>

<template>
  <textarea
    v-if="type === 'textarea'"
    :id="inputId"
    v-model="inputModel"
    @blur="onBlur"
    :placeholder="placeholder"
    :name="name"
    :disabled="disabled"
    :readonly="readonly"
    :maxlength="maxLength"
    :aria-required="required || undefined"
    :aria-invalid="!!error || undefined"
    :aria-describedby="ariaDescribedBy"
    :aria-label="!label ? name : undefined"
  />
  <input
    v-else
    :id="inputId"
    v-model="inputModel"
    @focus="onFocus"
    @blur="onBlur"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    :name="name"
    :type="type"
    :disabled="disabled"
    :readonly="readonly"
    :aria-required="required || undefined"
    :aria-invalid="!!error || undefined"
    :aria-describedby="ariaDescribedBy"
    :aria-label="!label ? name : undefined"
  />
</template>
