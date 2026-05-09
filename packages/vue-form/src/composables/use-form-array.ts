import type {
  FormArrayFieldDef,
  FormFieldDef,
  FormUnionFieldDef,
  FormUnionVariant,
} from "@atscript/ui";
import { getFieldMeta, createFormData, createFormValueResolver, isUnionField } from "@atscript/ui";
import { computed, inject, reactive, watch, type ComputedRef } from "vue";
import { CHANGE_HANDLER_KEY } from "./internal-keys";
import { useFormContext } from "./use-form-context";

/**
 * Composable for managing array field state.
 *
 * Manages stable keys, add/remove with constraints, and item field resolution.
 * Union item types are handled transparently — AsUnion manages variant state locally.
 * Used by the default `AsArray` component and available for custom array components.
 */
export function useFormArray(field: FormArrayFieldDef, disabled?: ComputedRef<boolean>) {
  const { rootFormData, formContext, pathPrefix, getByPath, setByPath } =
    useFormContext("useFormArray");
  const handleChange = inject(CHANGE_HANDLER_KEY, () => {});

  const arrayValue = computed<unknown[]>(() => {
    const v = getByPath(pathPrefix.value);
    return Array.isArray(v) ? v : [];
  });

  const isOptional = field.prop.optional ?? false;
  const isEmpty = computed(() => arrayValue.value.length === 0);

  let keyCounter = 0;
  const itemKeys: string[] = reactive([]);

  function generateKey(): string {
    return `as-item-${keyCounter++}`;
  }

  function syncKeys() {
    const newLen = arrayValue.value.length;
    while (itemKeys.length < newLen) itemKeys.push(generateKey());
    if (itemKeys.length > newLen) {
      for (const key of itemFieldCache.keys()) {
        if (key >= newLen) itemFieldCache.delete(key);
      }
      itemKeys.length = newLen;
    }
  }

  syncKeys();
  watch(
    () => arrayValue.value.length,
    () => syncKeys(),
  );

  const isUnion = isUnionField(field.itemField);
  const unionVariants: FormUnionVariant[] = isUnion
    ? (field.itemField as FormUnionFieldDef).unionVariants
    : [];

  // `name` doubles as AsField label fallback so primitive items read
  // `<singular> #N` via formatIndexedLabel without a separate decorator.
  const itemFieldCache = new Map<number, FormFieldDef>();

  function getItemField(index: number, name = ""): FormFieldDef {
    const cached = itemFieldCache.get(index);
    if (cached && cached.name === name) return cached;
    const fresh = { ...field.itemField, path: String(index), name };
    itemFieldCache.set(index, fresh);
    return fresh;
  }

  const minLength =
    (getFieldMeta(field.prop, "expect.minLength") as { length: number } | undefined)?.length ?? 0;
  const maxLength =
    (getFieldMeta(field.prop, "expect.maxLength") as { length: number } | undefined)?.length ??
    Infinity;
  const canAdd = computed(() => !disabled?.value && arrayValue.value.length < maxLength);
  const canRemove = computed(() => !disabled?.value && arrayValue.value.length > minLength);

  function ensureArray(): unknown[] {
    let arr = getByPath(pathPrefix.value);
    if (!Array.isArray(arr)) {
      arr = [];
      setByPath(pathPrefix.value, arr);
    }
    return arr as unknown[];
  }

  function addItem(variantIndex = 0) {
    if (!canAdd.value) return;
    const resolver = createFormValueResolver(
      rootFormData().value as Record<string, unknown>,
      formContext.value,
    );
    let newItem: unknown;
    if (isUnion) {
      const variant = unionVariants[variantIndex];
      if (!variant) return;
      newItem = createFormData(variant.type, resolver).value;
    } else {
      newItem = createFormData(field.itemType, resolver).value;
    }
    ensureArray().push(newItem);
    itemKeys.push(generateKey());
    handleChange("array-add", pathPrefix.value, arrayValue.value);
  }

  function removeItem(index: number) {
    if (!canRemove.value) return;
    ensureArray().splice(index, 1);
    itemKeys.splice(index, 1);
    // Cached `path` values shift with the array — invalidate from `index` up.
    for (const key of itemFieldCache.keys()) {
      if (key >= index) itemFieldCache.delete(key);
    }
    handleChange("array-remove", pathPrefix.value, arrayValue.value);
  }

  function clear() {
    if (isOptional) {
      setByPath(pathPrefix.value, undefined);
    } else {
      const arr = getByPath(pathPrefix.value);
      if (Array.isArray(arr)) arr.length = 0;
    }
    itemFieldCache.clear();
    handleChange("array-remove", pathPrefix.value, arrayValue.value);
  }

  return {
    arrayValue,
    itemKeys,
    isUnion,
    unionVariants,
    isOptional,
    isEmpty,
    getItemField,
    addItem,
    removeItem,
    clear,
    canAdd,
    canRemove,
  };
}
