<script setup lang="ts">
import { computed } from "vue";
import { AsField, AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";
import { isObjectField, type FormFieldDef } from "@atscript/ui";

/**
 * Custom object renderer — paints a flat card with a 2-row grid (street
 * full-width, city+zip on one row, country full-width). Opted-in per
 * field via `@ui.form.type 'address-card'`. Used by the
 * custom-components demo's `address: Address`.
 *
 * Wrapped in the library's `<AsFieldShell>` so the outer label,
 * description, and error chrome stay consistent with built-in fields.
 *
 * Skipped `useAsArray` / `useAsObject` (no public `useAsObject` exists
 * anyway) — the object case is just "iterate child fields and recurse
 * via <AsField>". AsField has already provided the right
 * PATH_PREFIX_KEY for us (it does that for every structured field),
 * so children compose their paths against `address` automatically.
 *
 * Styling: outer card sits on `layer-1` (one shade in from the form's
 * `layer-0` outer canvas), with the default `border-1` painted from the
 * active layer's border slot. Error state flips to `scope-error` which
 * re-tints the border via `current-border-hl`.
 */
const props = defineProps<TAsComponentProps>();

// Look up children by name from `objectDef.fields`. Iteration order
// doesn't matter — we render four specific named slots. Missing fields
// (schema drift) render nothing.
const objectDef = computed(() =>
  props.field && isObjectField(props.field) ? props.field.objectDef : undefined,
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
  <AsFieldShell v-bind="$props" data-testid="demo-address-card">
    <template #default>
      <section
        class="layer-1 border-1 rounded-r2 p-$m flex flex-col gap-$s"
        :class="{ 'scope-error current-border-hl border-current': !!error }"
      >
        <div class="flex flex-col gap-$s">
          <div>
            <AsField v-if="streetField" :field="streetField" />
          </div>
          <div class="grid grid-cols-[2fr_1fr] gap-$s">
            <AsField v-if="cityField" :field="cityField" />
            <AsField v-if="zipField" :field="zipField" />
          </div>
          <div>
            <AsField v-if="countryField" :field="countryField" />
          </div>
        </div>
      </section>
    </template>
  </AsFieldShell>
</template>
