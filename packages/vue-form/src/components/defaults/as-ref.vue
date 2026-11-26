<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxCancel,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  ComboboxViewport,
} from "reka-ui";
import { computed, inject, ref, watch } from "vue";
import { CLIENT_FACTORY_KEY, useAsValueHelp } from "../../composables/use-as-value-help";
import { emptiedKey, soleRow } from "../../composables/_shape";
import type { TAsComponentProps, TAsRefSlotProps } from "../types";
import AsFieldShell from "./as-field-shell.vue";
import AsInputControl from "../internal/as-input-control.vue";
import { useAsTexts } from "../../composables/use-as-locale";

const props = defineProps<TAsComponentProps>();
defineSlots<{
  /** After the input — a button opening another picker (since 0.1.190). */
  trailing?: (props: TAsRefSlotProps) => unknown;
  /** After the list — an entry such as "See all" (since 0.1.190). */
  "list-end"?: (props: TAsRefSlotProps) => unknown;
}>();

const info = props.valueHelp;

const open = ref(false);
// A read-only field never opens its list: it shows the value, there is nothing to pick.
const listOpen = computed({
  get: () => open.value,
  set: (v: boolean) => {
    open.value = v && !props.readonly;
  },
});

const vh = info
  ? useAsValueHelp({
      info,
      model: props.model,
      onBlur: props.onBlur,
      // a changed host value searches again while the list is open, else on its next open
      open,
      // a read-only field opens no list: it asks no rows
      readonly: () => !!props.readonly,
    })
  : undefined;

const resolved = vh?.resolved;
const results = vh?.results;
const status = vh?.status;
const searching = vh?.searching;

// Every pick goes through `selectItem` (since 0.1.190): it commits the value, writes the
// binding's fills and validates the field — with the row the user picked, which the
// item's `select` hands over just before the combobox commits its value. Values may
// repeat (a dictionary keyed by more fields than the committed one), so the row is never
// looked up by value, except when only one loaded row holds it.
let pickedRow: Record<string, unknown> | undefined;
function onItemSelect(item: Record<string, unknown>) {
  pickedRow = item;
}
function onPick(value: unknown) {
  const picked = pickedRow;
  pickedRow = undefined;
  const row =
    info &&
    (picked?.[info.targetField] === value
      ? picked
      : soleRow(results?.value ?? [], info.targetField, value));
  if (row) vh?.selectItem(row);
  else props.model.value = value;
}
// A key per row: the dictionary's primary key (the committed value may repeat).
function rowKey(item: Record<string, unknown>): string {
  const keys = resolved?.value?.primaryKeys ?? [];
  return keys.length > 0
    ? keys.map((k) => String(item[k])).join("\u0000")
    : String(item[info!.targetField]);
}
// The input's text. Bound so "×" can empty it: the cancel primitive only
// writes the element, which the next render of the input would undo.
const inputText = ref("");

// `@ui.valueLabel` (since 0.1.190): while the field is not being edited (or is read-only)
// the input shows the code with its text; focused, the code alone, to search from.
const focused = ref(false);
const showsLabel = () => props.valueLabel !== undefined && (props.readonly || !focused.value);
// What the input shows for the value — the combobox's own rule for a value without a label.
function displayValue(v: unknown): string {
  if (showsLabel()) return props.valueLabel!;
  return v && typeof v !== "object" ? String(v) : "";
}
watch(
  () => props.valueLabel,
  () => {
    if (!focused.value && !open.value) inputText.value = displayValue(props.model.value);
  },
);
// A focus given back by the slots (`focus()`, e.g. as a dialog closes) leaves the list closed.
const inputRef = ref<{ $el: HTMLElement } | null>(null);
let quietFocus = false;
function onInputFocus() {
  focused.value = true;
  if (props.valueLabel !== undefined && !props.readonly) {
    inputText.value = displayValue(props.model.value);
  }
  if (!quietFocus) listOpen.value = true;
}
function onInputBlur() {
  focused.value = false;
  // an open list puts the text back as it closes (`displayValue`)
  if (!open.value) inputText.value = displayValue(props.model.value);
  props.onBlur();
}
// A value committed while the list is closed (a pick from another picker, a fill) shows at once.
watch(
  () => props.model.value,
  (v) => {
    if (!open.value) inputText.value = displayValue(v);
  },
);

// What the `trailing` / `list-end` slots get (since 0.1.190): another picker commits through
// the same pick path, in the same scope, with the form's client factory.
const clientFactory = inject(CLIENT_FACTORY_KEY, null) ?? undefined;
function slotProps(): TAsRefSlotProps {
  return {
    searchText: vh?.searchText.value ?? "",
    selectItem: (row) => vh?.selectItem(row),
    scope: vh!.scope.value,
    clientFactory,
    close: () => {
      listOpen.value = false;
      inputText.value = displayValue(props.model.value);
    },
    focus: () => {
      quietFocus = true;
      inputRef.value?.$el.focus();
      quietFocus = false;
    },
  };
}

function onSearchInput(e: Event) {
  if (vh) vh.searchText.value = (e.target as HTMLInputElement).value;
}

// The list closing puts the value's text back into the input: the typed
// search is gone, so it no longer counts as something to clear.
watch(open, (isOpen) => {
  if (!isOpen && vh) vh.searchText.value = "";
});

// "×" empties the field as emptying an input does: an optional field is
// unset; a required one holds `""` (string key) or `null` (any other key).
const emptyValue = () => emptiedKey(props.field?.prop.type, props.optional);

const showClear = computed(() => {
  if (props.disabled || props.readonly || !vh) return false;
  const v = props.model.value;
  return vh.searchText.value !== "" || (v != null && v !== emptyValue());
});

// Runs after the cancel primitive has focused the input.
function onClear() {
  inputText.value = "";
  vh?.clear(emptyValue());
}
const { t } = useAsTexts();
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <!-- Fallback: plain text input when no ValueHelpInfo or target meta unreachable -->
      <AsInputControl
        v-if="!info || !vh || status === 'error'"
        v-bind="$props"
        type="text"
        :input-id="inputId"
      />

      <div v-else-if="status === 'loading' || !resolved" class="as-ref-loading">
        <span class="as-ref-spinner" aria-hidden="true" />
      </div>

      <!-- reka-ui Combobox for FK ref fields — value is the raw FK id. -->
      <ComboboxRoot
        v-else
        :model-value="model.value"
        v-model:open="listOpen"
        @update:model-value="onPick"
        :disabled="disabled"
        :name="name"
        ignore-filter
        class="as-ref-root"
      >
        <ComboboxAnchor class="as-ref-anchor">
          <ComboboxInput
            ref="inputRef"
            v-model="inputText"
            :display-value="displayValue"
            :id="inputId"
            :placeholder="placeholder"
            :disabled="disabled"
            :readonly="readonly"
            :aria-required="required || undefined"
            :aria-invalid="!!error || undefined"
            :aria-describedby="ariaDescribedBy"
            :aria-label="!label ? name : undefined"
            class="as-ref-input"
            @focus="onInputFocus"
            @input="onSearchInput"
            @blur="onInputBlur"
          />
          <ComboboxCancel
            v-if="showClear"
            class="as-ref-clear"
            :aria-label="label ? t('UI_FORM_CLEAR_FIELD', { field: label }) : t('UI_CLEAR')"
            @click="onClear"
          >
            &times;
          </ComboboxCancel>
        </ComboboxAnchor>
        <slot name="trailing" v-bind="slotProps()" />

        <ComboboxContent position="popper" side="bottom" :side-offset="4" class="as-ref-content">
          <ComboboxViewport class="as-ref-viewport">
            <div v-if="searching" class="as-ref-status">
              <span class="as-ref-spinner" aria-hidden="true" />
            </div>
            <template v-else>
              <ComboboxItem
                v-for="item in results"
                :key="rowKey(item)"
                :value="item[info.targetField]"
                class="as-ref-item"
                @select="onItemSelect(item)"
              >
                <span class="as-ref-item-id">{{ item[info.targetField] }}</span>
                <span class="as-ref-item-label">
                  {{ item[resolved.labelField] }}
                  <span
                    v-if="resolved.descrField && item[resolved.descrField]"
                    class="as-ref-item-description"
                  >
                    — {{ item[resolved.descrField] }}
                  </span>
                </span>
              </ComboboxItem>
              <ComboboxEmpty class="as-ref-status">{{ t("UI_FORM_NO_RESULTS") }}</ComboboxEmpty>
            </template>
          </ComboboxViewport>
          <slot name="list-end" v-bind="slotProps()" />
        </ComboboxContent>
      </ComboboxRoot>
    </template>
  </AsFieldShell>
</template>
