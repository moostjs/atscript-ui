import type { FormFieldDef, FormTupleFieldDef } from "@atscript/ui";
import {
  getFieldMeta,
  createFormData,
  createFormValueResolver,
  META_LABEL,
} from "@atscript/ui";
import { computed, inject, onMounted } from "vue";
import { CHANGE_HANDLER_KEY } from "./internal-keys";
import { useFormContext } from "./use-form-context";

/** Composable for managing tuple field state. Fixed-length, position-typed; auto-fills missing positions on mount unless optional. */
export function useFormTuple(field: FormTupleFieldDef) {
  const { rootFormData, formContext, pathPrefix, getByPath, setByPath } =
    useFormContext("useFormTuple");
  const handleChange = inject(CHANGE_HANDLER_KEY, () => {});

  const isOptional = field.prop.optional ?? false;

  // Pre-build itemFields once — tuple positions are fixed. `name` falls back
  // to `#N` so AsField's label-resolution chain renders an indexed label when
  // the position has no `@meta.label`.
  const itemFields: FormFieldDef[] = field.itemFields.map((itemField, i) => {
    const metaLabel = getFieldMeta(itemField.prop, META_LABEL) as string | undefined;
    return {
      ...itemField,
      path: String(i),
      name: metaLabel ?? `#${i + 1}`,
    };
  });

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
    isOptional,
    isEmpty,
    clear,
    fillMissing,
  };
}
