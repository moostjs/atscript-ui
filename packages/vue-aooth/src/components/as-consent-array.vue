<script setup lang="ts">
import { computed } from "vue";
import { AsFieldShell, useAsField, type TAsComponentProps } from "@atscript/vue-form";
import { getFieldMeta, META_LABEL } from "@atscript/ui";

/**
 * Single pending consent descriptor — fed via `@ui.form.attr` / `@ui.form.fn.attr`
 * on the consumer's `.as` schema.
 *
 * - `id` — value committed to the bound `string[]` when checked.
 * - `text` — checkbox label.
 * - `required` — non-empty string ⇒ mandatory consent; the string IS the
 *   surfaced error message. Empty/undefined ⇒ optional.
 */
export interface AsConsentArrayItem {
  id: string;
  text: string;
  required?: string;
}

const props = defineProps<
  TAsComponentProps<string[]> & {
    pendingConsents?: AsConsentArrayItem[];
  }
>();

// Sanitize ids for use in DOM `id` attributes — strip anything outside a
// safe id charset. Distinct stable ids per checkbox keep `<label :for>`
// wiring valid (HTML id uniqueness).
function rowId(itemId: string): string {
  const safe = itemId.replace(/[^A-Za-z0-9_-]/g, "_");
  return `${props.inputId}-${safe}`;
}

const consents = computed<AsConsentArrayItem[]>(() => props.pendingConsents ?? []);

// AsField always supplies `props.label` (fallback to the field's prop name),
// which produces a redundant "Consents" header above the checkbox group.
// Only render a label when the consumer explicitly sets `@meta.label` on
// the field — each checkbox already carries its own text.
const explicitLabel = computed<string | undefined>(() => {
  const prop = props.field?.prop;
  if (!prop) return undefined;
  const meta = getFieldMeta(prop, META_LABEL);
  return typeof meta === "string" ? meta : undefined;
});

// Register an additional field-state entry alongside the one AsField
// already created. `formState.register` is keyed by Symbol, so two
// registrations under the same path coexist; both rules run at submit
// time, and the gating (touched / blur / freshFields / firstSubmitHappened)
// is shared via the injected formState — no local touched ref needed.
const { error: localError, onBlur } = useAsField<string[]>({
  getValue: () => props.model.value ?? [],
  setValue: (v) => {
    props.model.value = v;
  },
  rules: [
    (value) => {
      for (const c of consents.value) {
        if (c.required && !value.includes(c.id)) {
          // First missing required item wins for the form-level error
          // string — per-item rendering still surfaces every miss below.
          return c.required;
        }
      }
      return true;
    },
  ],
  path: () => props.path,
  resetValue: [],
});

// `localError.value` is the single source of truth for "validation has
// fired against this field". It captures live rule output, submit-time
// validation, AND externally-pushed errors (e.g. backend errors set via
// `setErrors` propagate to every registration at the path). When it
// goes non-empty, per-item rows surface their tailored required
// messages; the shell footer is intentionally suppressed (see
// `:error="undefined"` on AsFieldShell) so the per-item rendering is
// the only error surface.
const showRequiredErrors = computed(() => !!localError.value);

// Per-item error surface — pinpoints each missing required consent
// with its own backend-supplied message. Gated by `showRequiredErrors`
// so messages only appear after the form considers validation active.
function errorFor(item: AsConsentArrayItem): string | undefined {
  if (!showRequiredErrors.value) return undefined;
  if (!item.required) return undefined;
  const value = props.model.value ?? [];
  if (value.includes(item.id)) return undefined;
  return item.required;
}

function commit(id: string, on: boolean) {
  const current = props.model.value ?? [];
  if (on) {
    // Append iff missing — preserves user insertion order. We do NOT
    // re-sort to match `pendingConsents`: the bound array reflects
    // the user's actions.
    if (current.indexOf(id) === -1) {
      props.model.value = [...current, id];
    }
  } else {
    const next = current.filter((v) => v !== id);
    if (next.length !== current.length) {
      props.model.value = next;
    }
  }
}

function onChange(id: string, ev: Event) {
  commit(id, (ev.target as HTMLInputElement).checked);
}

const isChecked = (id: string) => (props.model.value ?? []).includes(id);

// Markdown-link parser for consent text. Recognizes `[label](url)` where
// label has no `]` and url has no `)`. Anchors render only for safe
// schemes — http(s) and mailto. Anything else falls back to plain
// bracketed text (failing closed prevents silent stripping of dangerous
// schemes like `javascript:` while keeping the visible label intact).
type ConsentSegment =
  | { kind: "text"; value: string }
  | { kind: "link"; label: string; href: string };

// `matchAll` clones the regex internally, so module-scope reuse is safe
// across calls — no `lastIndex` reset needed.
const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const SAFE_SCHEME_RE = /^(?:https?:\/\/|mailto:)/i;

function parseConsentText(text: string): ConsentSegment[] {
  const segments: ConsentSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(MD_LINK_RE)) {
    const [full, label, href] = match;
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, idx) });
    }
    if (SAFE_SCHEME_RE.test(href)) {
      segments.push({ kind: "link", label, href });
    } else {
      // Unsafe / unknown scheme — fail closed, render the source verbatim.
      segments.push({ kind: "text", value: full });
    }
    lastIndex = idx + full.length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

// Parse once per consent list change instead of on every render — a
// keystroke that flips a checkbox shouldn't re-run regex over every
// item's text. Keyed by item id so the v-for keeps stable segment
// arrays across re-renders.
const consentSegments = computed(() => {
  const map = new Map<string, ConsentSegment[]>();
  for (const item of consents.value) {
    map.set(item.id, parseConsentText(item.text));
  }
  return map;
});
</script>

<template>
  <!--
    `:error="undefined"` suppresses the shell's footer error row. The
    backend / submit error string would otherwise render here AND under
    each missing-required item (per-item rendering is the canonical
    display, see `errorFor`) — that's the duplication we deliberately
    avoid. Must override `v-bind="$props".error`; the explicit binding
    wins via `mergeProps` semantics.

    `:class="{ error: showRequiredErrors }"` still paints the wrapper
    error chrome so the group reads as errored even with no shell
    footer.
  -->
  <AsFieldShell
    v-if="consents.length > 0"
    v-bind="$props"
    :label="explicitLabel"
    :error="undefined"
    :class="{ error: showRequiredErrors }"
    field-class="as-consent-array"
  >
    <template #default>
      <div class="as-consent-array-group" @blur.capture="onBlur">
        <div v-for="item in consents" :key="item.id" class="as-consent-array-item">
          <label :for="rowId(item.id)" class="as-consent-array-row">
            <input
              :id="rowId(item.id)"
              type="checkbox"
              :checked="isChecked(item.id)"
              :name="name"
              :disabled="disabled"
              :readonly="readonly"
              :aria-required="item.required ? 'true' : undefined"
              :aria-invalid="!!errorFor(item) || undefined"
              :aria-describedby="ariaDescribedBy"
              @change="(e) => onChange(item.id, e)"
            />
            <span class="as-consent-array-text" :class="{ required: !!item.required }">
              <template v-for="(seg, segIdx) in consentSegments.get(item.id)" :key="segIdx">
                <a
                  v-if="seg.kind === 'link'"
                  :href="seg.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="as-consent-array-link"
                  @click.stop
                  >{{ seg.label }}</a
                >
                <template v-else>{{ seg.value }}</template>
              </template>
            </span>
          </label>
          <div
            v-if="errorFor(item)"
            :id="`${rowId(item.id)}-err`"
            class="as-error-slot"
            role="alert"
          >
            {{ errorFor(item) }}
          </div>
        </div>
      </div>
    </template>
  </AsFieldShell>
</template>
