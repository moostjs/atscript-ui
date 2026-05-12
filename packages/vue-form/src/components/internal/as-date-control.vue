<script setup lang="ts">
import type { TAsComponentProps } from "../types";

/**
 * Internal date/datetime/time `<input>` renderer — the inner control
 * shared by `AsDate`, `AsDatetime`, `AsTime`. The native input `type`
 * (and value coercion) is resolved upstream by `useAsDate(kind)`; this
 * component only paints the input with the standard a11y wiring.
 *
 * Decoupled from the merged-chrome `AsAdornmentShell` so each date
 * variant can render this control once and either drop it directly into
 * AsFieldShell (no adornment) or inside the shell wrapper (any
 * adornment annotation). Lifts six near-identical `<input>` copies
 * across AsDate/AsDatetime/AsTime down to one.
 */
defineProps<
  TAsComponentProps<number | string | null | undefined> & {
    inputId: string;
    inputType: "date" | "datetime-local" | "time";
    displayValue: string;
    setFromInput: (raw: string) => void;
  }
>();
</script>

<template>
  <input
    :id="inputId"
    :type="inputType"
    :value="displayValue"
    @change="(e) => setFromInput((e.target as HTMLInputElement).value)"
    @blur="onBlur"
    :placeholder="placeholder"
    :name="name"
    :disabled="disabled"
    :readonly="readonly"
    :aria-required="required || undefined"
    :aria-invalid="!!error || undefined"
    :aria-describedby="ariaDescribedBy"
    :aria-label="!label ? name : undefined"
  />
</template>
