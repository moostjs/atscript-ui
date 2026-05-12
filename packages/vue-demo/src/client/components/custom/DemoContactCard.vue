<script setup lang="ts">
import { computed } from "vue";
import { AsField, AsFieldShell, type TAsComponentProps, useAsUnion } from "@atscript/vue-form";
import { isObjectField } from "@atscript/ui";

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
 * Wrapped in the library's `<AsFieldShell>` so the outer label,
 * description, and error chrome stay consistent with built-in fields.
 * `useAsUnion` does not provide `UNION_CONTEXT_KEY` itself (only the
 * default `as-union.vue` does), so the shell will not paint its own
 * variant picker on top of our custom one.
 *
 * Opted-in per field via `@ui.form.type 'contact-card'`. Used by the
 * custom-components demo's `contact: EmailContact | PhoneContact |
 * InPersonContact`.
 *
 * Styling: card sits on `layer-1`. Variant cards use `c8-outlined` at
 * rest; the active one opts into `scope-primary c8-filled` for a clear
 * accent. Dashed divider uses `border-t-1 border-dashed border-current/20`.
 */
const props = defineProps<TAsComponentProps>();

const { unionField, localUnionIndex, innerField, changeVariant } = useAsUnion(props);

const variants = computed(() => unionField.value?.unionVariants ?? []);

const activeFields = computed(() => {
  const inner = innerField.value;
  // Each variant in the demo is an object — `objectDef.fields` is
  // populated. Primitive-itemField variants would slip through with
  // an empty list here; the demo schema does not exercise that.
  return inner && isObjectField(inner) ? inner.objectDef.fields : [];
});

// Single-glyph icons matched to the variant labels (Email / Phone /
// In Person). Falls back to a generic dot when nothing matches.
function iconFor(label: string): string {
  if (/email/i.test(label)) return "✉";
  if (/phone/i.test(label)) return "☎";
  if (/person/i.test(label)) return "👤";
  return "•";
}

const disabled = computed(() => props.disabled ?? false);

function pick(index: number): void {
  if (disabled.value) return;
  if (localUnionIndex.value === index) return;
  changeVariant(index);
}

function onGroupBlur(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null;
  const group = e.currentTarget as HTMLElement;
  if (group && next && group.contains(next)) return;
  props.onBlur();
}
</script>

<template>
  <AsFieldShell v-bind="$props" data-testid="demo-contact-card">
    <template #default="{ inputId }">
      <section
        class="layer-1 border-1 rounded-r2 p-$m flex flex-col gap-$m"
        :class="{ 'scope-error current-border-hl border-current': !!error }"
        @focusout="onGroupBlur"
      >
        <div
          class="grid grid-cols-3 gap-$s"
          role="radiogroup"
          :aria-label="title || label || 'Contact method'"
        >
          <button
            v-for="(v, vi) in variants"
            :key="vi"
            :id="vi === 0 ? inputId : undefined"
            type="button"
            class="demo-contact-variant appearance-none flex flex-col items-center justify-center gap-$xs px-$s py-$m min-h-[5em] rounded-r0 cursor-pointer transition-colors duration-120 disabled-soft current-outline-hl focus-visible:outline focus-visible:i8-apply-outline"
            :class="localUnionIndex === vi ? 'scope-primary c8-filled' : 'c8-outlined'"
            :aria-checked="localUnionIndex === vi"
            role="radio"
            :disabled="disabled"
            @click="pick(vi)"
          >
            <span class="text-h3 leading-[1]" aria-hidden="true">{{ iconFor(v.label) }}</span>
            <span class="text-callout font-500">{{ v.label }}</span>
          </button>
        </div>

        <div
          v-if="activeFields.length"
          class="flex flex-col gap-$s border-t-1 border-dashed border-current/20 pt-$m"
        >
          <AsField v-for="f of activeFields" :key="f.path ?? f.name" :field="f" />
        </div>
      </section>
    </template>
  </AsFieldShell>
</template>
