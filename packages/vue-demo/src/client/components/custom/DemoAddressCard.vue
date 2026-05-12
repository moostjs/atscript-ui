<script setup lang="ts">
import { computed } from "vue";
import { AsField, type TAsComponentProps } from "@atscript/vue-form";
import { isObjectField, type FormObjectFieldDef, type FormFieldDef } from "@atscript/ui";

/**
 * Custom object renderer — paints a flat card with a 2-row grid (street
 * full-width, city+zip on one row, country full-width). Opted-in per
 * field via `@ui.form.type 'address-card'`. Used by the
 * custom-components demo's `address: Address`.
 *
 * Skipped `useAsArray` / `useAsObject` (no public `useAsObject` exists
 * anyway) — the object case is just "iterate child fields and recurse
 * via <AsField>". AsField has already provided the right
 * PATH_PREFIX_KEY for us (it does that for every structured field),
 * so children compose their paths against `address` automatically.
 */
const props = defineProps<TAsComponentProps>();

// Look up children by name from `objectDef.fields`. Iteration order
// doesn't matter — we render four specific named slots. Missing fields
// (schema drift) render nothing.
const objectDef = computed(() =>
  props.field && isObjectField(props.field)
    ? (props.field as FormObjectFieldDef).objectDef
    : undefined,
);

function fieldByName(name: string): FormFieldDef | undefined {
  return objectDef.value?.fields.find((f) => f.name === name);
}

const streetField = computed(() => fieldByName("street"));
const cityField = computed(() => fieldByName("city"));
const zipField = computed(() => fieldByName("zip"));
const countryField = computed(() => fieldByName("country"));
</script>

<template>
  <div class="demo-field" :class="{ hidden }" v-show="!hidden">
    <div v-if="description" :id="descId" class="demo-field-description">{{ description }}</div>
    <section
      class="demo-address-card"
      :class="{ error: !!error }"
      :aria-describedby="ariaDescribedBy"
    >
      <header class="demo-address-card-header">
        <h3 class="demo-address-card-title">{{ title ?? label ?? "Address" }}</h3>
      </header>
      <div class="demo-address-card-grid">
        <div class="demo-address-card-row demo-address-card-row-full">
          <AsField v-if="streetField" :field="streetField" />
        </div>
        <div class="demo-address-card-row demo-address-card-row-split">
          <AsField v-if="cityField" :field="cityField" />
          <AsField v-if="zipField" :field="zipField" />
        </div>
        <div class="demo-address-card-row demo-address-card-row-full">
          <AsField v-if="countryField" :field="countryField" />
        </div>
      </div>
    </section>
    <div
      v-if="error || hint"
      :id="errorId"
      class="demo-field-error"
      :role="error ? 'alert' : undefined"
    >
      {{ error || hint }}
    </div>
  </div>
</template>

<style scoped>
.demo-address-card {
  border: 1px solid currentColor;
  border-radius: 6px;
  padding: 12px 14px;
  opacity: 0.95;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.demo-address-card.error {
  border-color: #ef4444;
}
.demo-address-card-header {
  display: flex;
  align-items: center;
  border-bottom: 1px dashed currentColor;
  padding-bottom: 6px;
  opacity: 0.85;
}
.demo-address-card-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.demo-address-card-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.demo-address-card-row-full > :deep(.demo-field) {
  flex: 1 1 100%;
}
.demo-address-card-row-split {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 10px;
}
</style>
