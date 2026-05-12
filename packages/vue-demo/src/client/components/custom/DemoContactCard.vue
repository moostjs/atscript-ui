<script setup lang="ts">
import { computed } from "vue";
import { AsField, type TAsComponentProps, useAsUnion } from "@atscript/vue-form";

/**
 * Custom union renderer — three variant cards across the top (Email,
 * Phone, In Person), each with an icon glyph. Picking a card switches
 * the active variant via `useAsUnion`, which stashes the previous
 * variant's data so toggling back restores user input. Below the cards
 * the active variant's nested fields render via per-child `<AsField>`
 * (we iterate `innerField.objectDef.fields` directly rather than
 * dispatching to the default AsObject — that would re-render its own
 * collapsible chrome and double the framing inside the card).
 *
 * Opted-in per field via `@ui.form.type 'contact-card'`. Used by the
 * custom-components demo's `contact: EmailContact | PhoneContact |
 * InPersonContact`.
 */
const props = defineProps<TAsComponentProps>();

const { unionField, localUnionIndex, innerField, changeVariant } = useAsUnion(props);

const variants = computed(() => unionField.value?.unionVariants ?? []);

const activeFields = computed(() => {
  const inner = innerField.value;
  if (!inner) return [];
  // Each variant in the demo is an object — `objectDef.fields` is
  // populated. Primitive-itemField variants would slip through with
  // an empty list here; the demo schema does not exercise that.
  // biome-ignore lint/suspicious/noExplicitAny: structural read off synthesized field
  const def = (inner as any).objectDef;
  return def?.fields ?? [];
});

// Single-glyph icons matched to the variant labels (Email / Phone /
// In Person). Falls back to a generic dot when nothing matches.
function iconFor(label: string): string {
  if (/email/i.test(label)) return "✉";
  if (/phone/i.test(label)) return "☎";
  if (/person/i.test(label)) return "👤";
  return "•";
}

function pick(index: number): void {
  if (disabled.value) return;
  if (localUnionIndex.value === index) return;
  changeVariant(index);
}

const disabled = computed(() => props.disabled ?? false);

function onGroupBlur(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null;
  const group = e.currentTarget as HTMLElement;
  if (group && next && group.contains(next)) return;
  props.onBlur();
}
</script>

<template>
  <div class="demo-field" :class="{ hidden }" v-show="!hidden">
    <label v-if="title || label" class="demo-field-label">{{ title ?? label }}</label>
    <div v-if="description" :id="descId" class="demo-field-description">{{ description }}</div>
    <section
      class="demo-contact-card"
      :class="{ error: !!error }"
      :aria-describedby="ariaDescribedBy"
      @focusout="onGroupBlur"
    >
      <div
        class="demo-contact-variants"
        role="radiogroup"
        :aria-label="title || label || 'Contact method'"
      >
        <button
          v-for="(v, vi) in variants"
          :key="vi"
          :id="vi === 0 ? inputId : undefined"
          type="button"
          class="demo-contact-variant"
          :class="{ selected: localUnionIndex === vi }"
          :aria-checked="localUnionIndex === vi"
          role="radio"
          :disabled="disabled"
          @click="pick(vi)"
        >
          <span class="demo-contact-variant-icon" aria-hidden="true">{{ iconFor(v.label) }}</span>
          <span class="demo-contact-variant-label">{{ v.label }}</span>
        </button>
      </div>

      <div v-if="activeFields.length" class="demo-contact-body">
        <AsField v-for="f of activeFields" :key="f.path ?? f.name" :field="f" />
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
.demo-contact-card {
  border: 1px solid currentColor;
  border-radius: 6px;
  padding: 12px 14px;
  opacity: 0.95;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.demo-contact-card.error {
  border-color: #ef4444;
}
.demo-contact-variants {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.demo-contact-variant {
  appearance: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 8px;
  min-height: 80px;
  border: 1px solid currentColor;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  opacity: 0.7;
  transition:
    opacity 0.1s ease,
    box-shadow 0.1s ease;
}
.demo-contact-variant:hover:not(:disabled) {
  opacity: 0.95;
}
.demo-contact-variant.selected {
  opacity: 1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.55);
  background: rgba(99, 102, 241, 0.1);
}
.demo-contact-variant:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.demo-contact-variant:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.demo-contact-variant-icon {
  font-size: 22px;
  line-height: 1;
}
.demo-contact-variant-label {
  font-size: 12px;
  font-weight: 500;
}
.demo-contact-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px dashed currentColor;
  padding-top: 10px;
}
</style>
