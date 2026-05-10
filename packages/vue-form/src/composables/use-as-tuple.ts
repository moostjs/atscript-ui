import type { FormFieldDef, FormTupleFieldDef } from "@atscript/ui";
import { getFieldMeta, createFormData, createFormValueResolver, META_LABEL } from "@atscript/ui";
import { computed, inject, onMounted, type ComputedRef } from "vue";
import { CHANGE_HANDLER_KEY } from "./internal-keys";
import { useFormContext } from "./use-form-context";

export interface UseAsTupleReturn {
  itemFields: FormFieldDef[];
  positionLabeled: boolean[];
  isOptional: boolean;
  isEmpty: ComputedRef<boolean>;
  clear: () => void;
  fillMissing: () => void;
}

/** Composable for managing tuple field state. Fixed-length, position-typed; auto-fills missing positions on mount unless optional. */
export function useAsTuple(field: FormTupleFieldDef): UseAsTupleReturn {
  const { rootFormData, formContext, pathPrefix, getByPath, setByPath } =
    useFormContext("useAsTuple");
  const handleChange = inject(CHANGE_HANDLER_KEY, () => {});

  const isOptional = field.prop.optional ?? false;

  // Tuple positions are fixed — build itemFields and labeled flags in one pass.
  // Empty `name` lets AsField fall back to the position's `@meta.label`; when a
  // position has no label, AsTuple passes `:array-index` for the muted `#N` suffix.
  const itemFields: FormFieldDef[] = [];
  const positionLabeled: boolean[] = [];
  for (let i = 0; i < field.itemFields.length; i++) {
    const itemField = field.itemFields[i];
    itemFields.push({ ...itemField, path: String(i), name: "" });
    positionLabeled.push(getFieldMeta(itemField.prop, META_LABEL) !== undefined);
  }

  const isEmpty = computed(() => {
    const v = getByPath(pathPrefix.value);
    return !Array.isArray(v) || v.length === 0;
  });

  function fillMissing() {
    let arr = getByPath(pathPrefix.value);
    if (!Array.isArray(arr)) {
      arr = [];
      setByPath(pathPrefix.value, arr);
    }
    const tail = arr as unknown[];
    if (tail.length >= itemFields.length) return;
    const resolver = createFormValueResolver(
      rootFormData().value as Record<string, unknown>,
      formContext.value,
    );
    for (let i = tail.length; i < itemFields.length; i++) {
      tail.push(createFormData(field.itemFields[i].prop, resolver).value);
    }
    handleChange("array-add", pathPrefix.value, tail);
  }

  function clear() {
    if (!isOptional) return;
    setByPath(pathPrefix.value, undefined);
    handleChange("array-remove", pathPrefix.value, undefined);
  }

  onMounted(() => {
    if (!isOptional) fillMissing();
  });

  return {
    itemFields,
    positionLabeled,
    isOptional,
    isEmpty,
    clear,
    fillMissing,
  };
}
