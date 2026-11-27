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
import { computed, inject, ref, shallowRef, watch } from "vue";
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
// binding's fills and validates the field — with the row the user picked, handed over by
// the item's `select` (a click or Enter). Values may repeat (a dictionary keyed by more
// fields than the committed one), so a row is never looked up by value: the list's items
// are the rows' keys, and a pick of another row holding the value the field already holds
// is a pick too (since 0.1.191).
const pickedRow = shallowRef<Record<string, unknown>>();
function pickRow(row: Record<string, unknown>) {
  pickedRow.value = row;
  vh?.selectItem(row);
}
// A key per row: the dictionary's primary key (the committed value may repeat).
function rowKey(item: Record<string, unknown>): string {
  const keys = resolved?.value?.primaryKeys ?? [];
  return keys.length > 0
    ? keys.map((k) => String(item[k])).join("\u0000")
    : String(item[info!.targetField]);
}
// The row the list marks as selected: the one picked while the field still holds its value,
// else the one loaded row holding the value (a value loaded with the record). While the list
// is open and the value unchanged it stays as it was — also while a typed search narrows the
// rows or is cleared again: a changed key would make the combobox put the value's text back
// over the typed one.
let shownKey: string | undefined;
let shownFor: unknown;
const selectedKey = computed(() => {
  if (!info) return undefined;
  const value = props.model.value;
  const picked = pickedRow.value;
  if (picked && Object.is(picked[info.targetField], value)) {
    shownFor = value;
    return (shownKey = rowKey(picked));
  }
  if (open.value && Object.is(shownFor, value)) return shownKey;
  shownFor = value;
  const row = soleRow(results?.value ?? [], info.targetField, value);
  return (shownKey = row ? rowKey(row) : undefined);
});
// `@ui.valueHelp.column` key members other than the committed field (since 0.1.191): each
// item shows their values next to its key, so rows holding the same value read apart.
const keyColumns = computed(() => {
  const keys = resolved?.value?.primaryKeys ?? [];
  return (info?.columns ?? []).filter((c) => c !== info?.targetField && keys.includes(c));
});
function itemKey(item: Record<string, unknown>): string {
  const parts = [item[info!.targetField], ...keyColumns.value.map((c) => item[c])];
  return parts.filter((v) => v !== undefined && v !== null && v !== "").join(" · ");
}
// The input's text. Bound so "×" can empty it: the cancel primitive only
// writes the element, which the next render of the input would undo.
const inputText = ref("");

// `@ui.valueLabel` (since 0.1.190): while the field is not being edited (or is read-only)
// the input shows the code with its text; focused, the code alone, to search from.
const focused = ref(false);
const showsLabel = () => props.valueLabel !== undefined && (props.readonly || !focused.value);
// What the input shows for the field's value — the combobox's own rule for a value without
// a label. Always the field's value: the combobox's own value is the selected row's key.
function displayValue(): string {
  if (showsLabel()) return props.valueLabel!;
  const v = props.model.value;
  return v && typeof v !== "object" ? String(v) : "";
}
watch(
  () => props.valueLabel,
  () => {
    if (!focused.value && !open.value) inputText.value = displayValue();
  },
);
// A focus given back by the slots (`focus()`, e.g. as a dialog closes) leaves the list closed.
const inputRef = ref<{ $el: HTMLElement } | null>(null);
let quietFocus = false;
function onInputFocus() {
  focused.value = true;
  if (props.valueLabel !== undefined && !props.readonly) {
    inputText.value = displayValue();
  }
  if (!quietFocus) listOpen.value = true;
}
function onInputBlur() {
  focused.value = false;
  // an open list puts the text back as it closes (`displayValue`)
  if (!open.value) inputText.value = displayValue();
  props.onBlur();
}
// A value committed while the list is closed (a pick from another picker, a fill) shows at once.
watch(
  () => props.model.value,
  () => {
    if (!open.value) inputText.value = displayValue();
  },
);

// What the `trailing` / `list-end` slots get (since 0.1.190): another picker commits through
// the same pick path, in the same scope, with the form's client factory.
const clientFactory = inject(CLIENT_FACTORY_KEY, null) ?? undefined;
function slotProps(): TAsRefSlotProps {
  return {
    searchText: vh?.searchText.value ?? "",
    selectItem: pickRow,
    scope: vh!.scope.value,
    clientFactory,
    close: () => {
      listOpen.value = false;
      inputText.value = displayValue();
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

      <!-- reka-ui Combobox for FK ref fields — its value is the selected row's key; a pick
           commits the row's value through `pickRow`. -->
      <ComboboxRoot
        v-else
        :model-value="selectedKey"
        v-model:open="listOpen"
        :disabled="disabled"
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
                :value="rowKey(item)"
                class="as-ref-item"
                @select="pickRow(item)"
              >
                <span class="as-ref-item-id">{{ itemKey(item) }}</span>
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
        <!-- The field's value for a native form, as every other control carries it (the
             combobox's own value is the selected row's key). After the visible input. -->
        <input
          v-if="name"
          type="hidden"
          :name="name"
          :value="model.value ?? ''"
          :disabled="disabled"
        />
      </ComboboxRoot>
    </template>
  </AsFieldShell>
</template>
