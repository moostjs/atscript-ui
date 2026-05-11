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
  // When the position carries `@meta.label`, AsField picks it up and renders
  // it as the bold label (no `#N` suffix). When it does NOT, we fall back to
  // the type name (`number` → capitalized by `formatIndexedLabelParts` to
  // `Number`) as the `name` so AsField still has a base label to render
  // alongside the muted `#N` suffix passed via `:array-index`.
  const itemFields: FormFieldDef[] = [];
  const positionLabeled: boolean[] = [];
  for (let i = 0; i < field.itemFields.length; i++) {
    const itemField = field.itemFields[i];
    const labeled = getFieldMeta(itemField.prop, META_LABEL) !== undefined;
    const fallbackName = labeled ? "" : itemField.type;
    itemFields.push({ ...itemField, path: String(i), name: fallbackName });
    positionLabeled.push(labeled);
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
