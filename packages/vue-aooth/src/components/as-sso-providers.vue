<script setup lang="ts">
import { computed } from "vue";
import { AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";

/**
 * Single SSO provider descriptor — fed via `@ui.form.attr` /
 * `@ui.form.fn.attr` on the consumer's `.as` schema (the aooth backend
 * supplies the resolved list at runtime).
 *
 * - `id` — committed to the bound model (`model.value = id`) on click and
 *   carried by the fired form action; identifies which provider the
 *   workflow should redirect to.
 * - `text` — rendered VERBATIM. The backend owns the full display string
 *   (e.g. "Continue with Google" for a main-stack button, "Discord" for a
 *   secondary chip). We never compose a "Continue with {name}" prefix.
 * - `icon` — optional CSS class painting the brand glyph (e.g.
 *   `i-logos-google-icon`). Applied as-is; the consumer owns the safelist /
 *   preset coverage, same contract as `prefixIcon`.
 * - `secondary` — `true` ⇒ renders as a compact chip below the "or" divider;
 *   omitted/false ⇒ renders as a full-width button in the main stack (the
 *   default).
 */
export interface AsSsoProvider {
  id: string;
  text: string;
  icon?: string;
  secondary?: boolean;
}

const props = defineProps<
  TAsComponentProps<string | undefined> & {
    providers?: AsSsoProvider[];
  }
>();

const emit = defineEmits<{
  (e: "action", name: string): void;
}>();

// Partition the backend list into the main stack / below-divider chips in a
// single pass — preserving backend order within each group. Providers default
// to the prominent main stack; only `secondary: true` opts into the compact
// chip group below the "or" divider. A single `for` loop (filling both buckets
// at once) beats two `.filter()` passes or two separate computeds: one
// traversal, one reactive node, no intermediate arrays (see CLAUDE.md
// list-building guidance).
const groups = computed<{ primary: AsSsoProvider[]; secondary: AsSsoProvider[] }>(() => {
  const primary: AsSsoProvider[] = [];
  const secondary: AsSsoProvider[] = [];
  for (const p of props.providers ?? []) {
    (p.secondary === true ? secondary : primary).push(p);
  }
  return { primary, secondary };
});

// The "or" divider is purely a separator between the two groups — it only
// makes sense when BOTH groups are populated. A lone group with a dangling
// divider reads as broken.
const hasBoth = computed(
  () => groups.value.primary.length > 0 && groups.value.secondary.length > 0,
);

// One-click contract (locked by the user): clicking ANY provider button
// selects it (writes its id to the bound model) AND immediately fires the
// form action so the data-carrying `@wf.action.withData` submits with the
// chosen provider. There is no separate "Continue" button.
function select(provider: AsSsoProvider) {
  if (props.disabled) return;
  props.model.value = provider.id;
  // Selecting without a wired action still commits the id (above) but has
  // nothing to fire — guard so we never emit an undefined action name.
  if (props.formAction) emit("action", props.formAction.id);
}
</script>

<template>
  <!--
    `:chromeless="true"` suppresses the auto-label / description chrome
    AsFieldShell would otherwise draw. The SSO field carries
    `@meta.label 'Or sign in with'`, but the picker is self-describing
    (the "or" divider IS the visual separator) so a header would be
    redundant — mirrors as-password-rules.vue's chromeless choice.

    `:form-action="undefined"` suppresses the shell's footer action link.
    The field carries `@ui.form.action 'sso', 'Continue'` so `formAction`
    is truthy, and AsFieldShell would otherwise draw an `as-field-action-link`
    "Continue" button in its footer (chromeless does NOT suppress that footer).
    Here the provider buttons ARE the action — clicking one selects AND fires
    the action in a single click — so a separate footer "Continue" is a
    redundant control that would fire with NO provider chosen. `select()` still
    reads `props.formAction` internally to emit the action; only the shell's own
    footer link is suppressed. Overrides `v-bind="$props".formAction` — the
    explicit binding wins via `mergeProps` semantics (same technique as
    as-consent-array's `:error="undefined"`).

    The whole tree is gated on a non-empty provider list — same
    hide-when-empty contract as AsConsentArray; a persistent empty shell
    reads as broken UI (and guards the transient first render before
    `@ui.form.fn.attr` resolves).
  -->
  <AsFieldShell
    v-if="providers && providers.length > 0"
    v-bind="$props"
    :chromeless="true"
    :form-action="undefined"
    field-class="as-sso-providers"
  >
    <!--
      Layout: providers default to the prominent main stack (full-width
      buttons); only those flagged `secondary: true` drop below the "or"
      divider as compact chips.

      Wrap the three groups in a SINGLE `as-sso-providers-stack` child so the
      shell's `as-field-input-row` (a flex ROW) holds one column owner;
      otherwise the main stack, divider, and secondary group would lay out
      side-by-side in the row. The stack owns the vertical layout (mirrors
      as-consent-array's single `as-consent-array-group` child).
    -->
    <div class="as-sso-providers-stack">
      <!-- Main stack: full-width buttons, one per default (non-secondary) provider. -->
      <div v-if="groups.primary.length" class="as-sso-providers-primary">
        <button
          v-for="p in groups.primary"
          :key="p.id"
          type="button"
          class="as-sso-provider-btn"
          :disabled="disabled"
          @click="select(p)"
        >
          <span v-if="p.icon" :class="p.icon" class="as-sso-provider-icon" aria-hidden="true" />
          <span>{{ p.text }}</span>
        </button>
      </div>

      <!-- "or" divider — only between two populated groups. -->
      <div v-if="hasBoth" class="as-sso-providers-divider">
        <span>or</span>
      </div>

      <!-- Secondary group: compact chips for `secondary: true` providers. -->
      <div v-if="groups.secondary.length" class="as-sso-providers-secondary">
        <button
          v-for="p in groups.secondary"
          :key="p.id"
          type="button"
          class="as-sso-provider-chip"
          :disabled="disabled"
          @click="select(p)"
        >
          <span v-if="p.icon" :class="p.icon" class="as-sso-provider-icon" aria-hidden="true" />
          <span>{{ p.text }}</span>
        </button>
      </div>
    </div>
  </AsFieldShell>
</template>
